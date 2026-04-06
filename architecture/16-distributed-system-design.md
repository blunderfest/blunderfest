# Distributed System Design

## Overview

This document addresses the critical distributed system concerns identified during review, including write coordination, consistency model, and sharding strategy. It supersedes the distributed architecture described in previous documents.

## Critical Issues Addressed

1. **Write Coordination** - Underspecified in previous documents
2. **Sharding Strategy** - Three competing strategies (ECO, date, hash) with no clarity
3. **Consistency Model** - Eventual consistency not documented
4. **Failure Scenarios** - Missing recovery procedures

## Design Principles

1. **Single Responsibility** - Each component has one clear purpose
2. **Hot/Cold Separation** - Frequently accessed data on local SSD, cold data on S3
3. **Append-Only** - No in-place updates to avoid race conditions
4. **Eventual Consistency** - Acceptable for most operations with clear SLA

## Architecture Overview

```
+------------------------------------------------------------------+
|                     Distributed Architecture                        |
+------------------------------------------------------------------+
|                                                                   |
|  +------------------+  +------------------+  +------------------+ |
|  |   API Node 1     |  |   API Node 2     |  |   API Node 3     | |
|  |   (Phoenix)      |  |   (Phoenix)      |  |   (Phoenix)      | |
|  +--------+---------+  +--------+---------+  +--------+---------+ |
|           |                     |                     |            |
|  +--------v---------+  +--------v---------+  +--------v---------+ |
|  |   Hot Storage    |  |   Hot Storage    |  |   Hot Storage    | |
|  |  - Position idx  |  |  - Position idx  |  |  - Position idx  | |
|  |  - Player idx    |  |  - Player idx    |  |  - Player idx    | |
|  |  - Query cache  |  |  - Query cache  |  |  - Query cache  | |
|  +--------+---------+  +--------+---------+  +--------+---------+ |
|           |                     |                     |            |
+-----------|---------------------|---------------------|------------+
            |                     |                     |
            +--------+-----------+---------------------+
                     |
            +--------v---------+
            |  Cold Storage     |
            |  (S3/MinIO)      |
            |  - Game segments  |
            |  - Backups        |
            +--------+---------+
                     |
            +--------v---------+
            |  Metadata Store  |
            |  (PostgreSQL)    |
            |  - Shard map     |
            |  - Node registry |
            |  - WAL           |
            |  - Auth/keys     |
            +------------------+
```

## Sharding Strategy

### Primary Strategy: Consistent Hashing

We adopt **consistent hashing** as the single primary sharding strategy, replacing the three conflicting strategies (ECO, date, hash) mentioned in previous documents.

### Why Consistent Hashing?

| Strategy | Pros | Cons |
|----------|------|------|
| Consistent Hashing | Even distribution, minimal reshuffling on add/remove | More complex implementation |
| ECO Sharding | Domain-relevant | Uneven distribution, cross-shard queries hard |
| Date Sharding | Simple | Uneven distribution, time hotspots |

### Hash Key Computation

```elixir
defmodule Blunderfest.Distributed.ShardKey do
  @moduledoc """
  Compute shard key for consistent hashing.
  """
  
  @shard_count 256  # Virtual nodes per physical node
  @ring_size 1_000_000
  
  @doc """
  Compute shard key from game ID.
  """
  @spec compute_shard_key(integer()) :: non_neg_integer()
  def compute_shard_key(game_id) do
    # Use FNV-1a hash for better distribution
    fnv1a_hash(game_id)
    |> rem(@ring_size)
  end
  
  @doc """
  Get the node responsible for a game.
  """
  @spec get_node(non_neg_integer(), [node_info()]) :: node_info() | nil
  def get_node(shard_key, nodes) do
    # Find first node with ring position >= shard_key
    nodes
    |> Enum.filter(&(&1.status == :active))
    |> Enum.sort_by(& &1.ring_position)
    |> Enum.find(nil, fn node -> node.ring_position >= shard_key end)
    |> case do
      nil ->  # Wrap around to first node
        nodes
        |> Enum.filter(&(&1.status == :active))
        |> Enum.sort_by(& &1.ring_position)
        |> List.first()
      node -> node
    end
  end
  
  @doc """
  Find fallback node if primary is unavailable.
  """
  @spec get_fallback_node(non_neg_integer(), [node_info()], node_info()) :: node_info()
  def get_fallback_node(shard_key, nodes, primary_node) do
    # Find next node in ring after primary
    nodes
    |> Enum.filter(&(&1.status == :active and &1.node_id != primary_node.node_id))
    |> Enum.sort_by(& &1.ring_position)
    |> Enum.drop_while(&(&1.ring_position <= primary_node.ring_position))
    |> List.first()
    |> case do
      nil ->  # Wrap around
        nodes
        |> Enum.filter(&(&1.status == :active and &1.node_id != primary_node.node_id))
        |> Enum.sort_by(& &1.ring_position)
        |> List.first()
      node -> node
    end
  end
  
  # FNV-1a hash implementation
  defp fnv1a_hash(0), do: 0xcbf29ce484222325
  defp fnv1a_hash(n) when is_integer(n) do
    fnv1a_hash(<<n::64>>, 0xcbf29ce484222325)
  end
  defp fnv1a_hash(<<byte, rest::binary>>, hash) do
    new_hash = :erlang.bxor(hash, byte) * 0x100000001b3
    fnv1a_hash(rest, new_hash)
  end
  defp fnv1a_hash(<<>>, hash), do: hash
end
```

### Virtual Nodes

```elixir
defmodule Blunderfest.Distributed.Ring do
  @moduledoc """
  Consistent hashing ring with virtual nodes.
  """
  
  defstruct [:nodes, :virtual_nodes_per_physical]
  
  @type t :: %__MODULE__{
    nodes: %{String.t() => physical_node()},
    virtual_nodes: %{non_neg_integer() => String.t()},  # position -> node_id
    virtual_nodes_per_physical: pos_integer()
  }
  
  @type physical_node :: %{
    node_id: String.t(),
    host: String.t(),
    port: pos_integer(),
    ring_position: non_neg_integer(),
    status: atom(),
    segments: [String.t()]
  }
  
  @spec create([physical_node()], pos_integer()) :: t()
  def create(nodes, virtual_nodes \\ 256) do
    # Build virtual node ring
    virtual_nodes_map = build_virtual_ring(nodes, virtual_nodes)
    
    %__MODULE__{
      nodes: Map.new(nodes, fn n -> {n.node_id, n} end),
      virtual_nodes: virtual_nodes_map,
      virtual_nodes_per_physical: virtual_nodes
    }
  end
  
  defp build_virtual_ring(nodes, vnodes_per_physical) do
    nodes
    |> Enum.flat_map(fn node ->
      Enum.map(0..(vnodes_per_physical - 1), fn vnode_idx ->
        # Compute virtual node position
        key = "#{node.node_id}:#{vnode_idx}"
        position = :crypto.hash(:sha256, key)
                  |> :binary.decode_unsigned()
                  |> rem(1_000_000)
        {position, node.node_id}
      end)
    end)
    |> Enum.into(%{})
  end
  
  @spec find_node(t(), non_neg_integer()) :: String.t() | nil
  def find_node(%__MODULE__{} = ring, key) do
    ring.virtual_nodes
    |> Map.keys()
    |> Enum.sort()
    |> Enum.find(fn pos -> pos >= key end)
    |> case do
      nil ->  # Wrap around
        Map.get(ring.virtual_nodes, 0)
      pos ->
        Map.get(ring.virtual_nodes, pos)
    end
  end
end
```

### Shard Map (PostgreSQL)

```sql
-- Shard map: tracks which nodes own which shards
CREATE TABLE shard_map (
  shard_id      TEXT PRIMARY KEY,
  node_id       TEXT NOT NULL REFERENCES node_registry(node_id),
  segment_ids   TEXT[] NOT NULL DEFAULT '{}',
  game_count    BIGINT DEFAULT 0,
  position_count BIGINT DEFAULT 0,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Node registry: tracks all nodes in cluster
CREATE TABLE node_registry (
  node_id       TEXT PRIMARY KEY,
  host          TEXT NOT NULL,
  port          INTEGER NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('api', 'analysis', 'storage')),
  status        TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  last_seen     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for node lookup
CREATE INDEX idx_node_registry_status ON node_registry(status);
CREATE INDEX idx_shard_map_node ON shard_map(node_id);
```

## Write Coordination

### Write-Ahead Log (WAL)

Every write goes through the WAL before being considered committed:

```elixir
defmodule Blunderfest.Distributed.WAL do
  @moduledoc """
  Write-Ahead Log for distributed coordination.
  """
  
  use GenServer
  
  @type entry :: %{
    id: pos_integer(),
    segment_id: String.t(),
    operation: atom(),
    payload: term(),
    created_at: DateTime.t(),
    applied: boolean()
  }
  
  defstruct [:pool, :last_applied_id]
  
  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end
  
  @impl true
  def init(opts) do
    pool = Keyword.fetch!(opts, :pool)  # Postgrex pool
    
    # Get last applied ID on startup
    last_applied = get_last_applied_id(pool)
    
    {:ok, %__MODULE__{pool: pool, last_applied_id: last_applied}}
  end
  
  @spec append(String.t(), atom(), term()) :: {:ok, pos_integer()} | {:error, term()}
  def append(segment_id, operation, payload) do
    GenServer.call(__MODULE__, {:append, segment_id, operation, payload})
  end
  
  @impl true
  def handle_call({:append, segment_id, operation, payload}, _from, state) do
    # Insert into WAL
    {:ok, id} = Postgrex.query!(
      state.pool,
      """
      INSERT INTO write_ahead_log (segment_id, operation, payload, applied)
      VALUES ($1, $2, $3, false)
      RETURNING id
      """,
      [segment_id, operation, Jason.encode!(payload)]
    )
    
    {:reply, {:ok, hd(id.rows)[0]}, state}
  end
  
  @spec mark_applied(pos_integer()) :: :ok
  def mark_applied(id) do
    GenServer.cast(__MODULE__, {:mark_applied, id})
  end
  
  @impl true
  def handle_cast({:mark_applied, id}, state) do
    Postgrex.query!(
      state.pool,
      "UPDATE write_ahead_log SET applied = true WHERE id = $1",
      [id]
    )
    
    {:noreply, %{state | last_applied_id: max(state.last_applied_id, id)}}
  end
  
  @spec get_unapplied(pos_integer()) :: [entry()]
  def get_unapplied(since_id \\ 0) do
    # This would query PostgreSQL
    []
  end
  
  defp get_last_applied_id(pool) do
    case Postgrex.query!(pool, "SELECT MAX(id) FROM write_ahead_log WHERE applied = true") do
      %{rows: [[nil]]} -> 0
      %{rows: [[max_id]]} -> max_id
    end
  end
end
```

### Write Flow

```
Client Request
      |
      v
+-------------+
|   API Node  |
+------+------+
       |
       v
+-------------------------+
| 1. Acquire segment lock  |  (PostgreSQL advisory lock)
+-------------------------+
       |
       v
+-------------------------+
| 2. Serialize game       |
+-------------------------+
       |
       v
+-------------------------+
| 3. Append to WAL        |  (get WAL sequence number)
+-------------------------+
       |
       v
+-------------------------+
| 4. Write to segment     |  (append-only, local disk)
+-------------------------+
       |
       v
+-------------------------+
| 5. Update hot index      |
+-------------------------+
       |
       v
+-------------------------+
| 6. Commit WAL           |  (mark as applied)
+-------------------------+
       |
       v
+-------------------------+
| 7. Background sync      |  (upload to S3)
+-------------------------+
       |
       v
Response: {game_id, segment_id, wal_sequence}
```

### Distributed Locking

```elixir
defmodule Blunderfest.Distributed.Lock do
  @moduledoc """
  Distributed locking using PostgreSQL advisory locks.
  """
  
  @spec acquire_segment_lock(String.t(), integer()) :: 
    {:ok, reference()} | {:error, :locked}
  def acquire_segment_lock(segment_id, timeout_ms \\ 5000) do
    lock_key = :erlang.phash2(segment_id)
    
    Postgrex.query!(
      pool(),
      "SELECT pg_try_advisory_lock($1)",
      [lock_key]
    )
    |> case do
      %{rows: [[true]]} ->
        {:ok, make_ref()}
      %{rows: [[false]]} ->
        {:error, :locked}
    end
  end
  
  @spec release_segment_lock(String.t(), reference()) :: :ok
  def release_segment_lock(segment_id, _ref) do
    lock_key = :erlang.phash2(segment_id)
    
    Postgrex.query!(pool(), "SELECT pg_advisory_unlock($1)", [lock_key])
    :ok
  end
  
  defp pool, do: Application.get_env(:blunderfest, :postgres_pool)
end
```

## Consistency Model

### Eventual Consistency

Most operations are eventually consistent:

| Operation | Consistency | Latency |
|-----------|-------------|---------|
| Position lookup | Eventual | 0-5 seconds |
| Game retrieval | Eventual | 0-5 seconds |
| Opening stats | Eventual | 0-30 seconds |
| Player stats | Eventual | 0-30 seconds |

### Read Your Own Writes

For write confirmation:

```elixir
defmodule Blunderfest.Distributed.ReadAfterWrite do
  @moduledoc """
  Read-after-write consistency for critical operations.
  """
  
  @spec write_and_confirm(Game.t()) :: {:ok, Game.t()} | {:error, term()}
  def write_and_confirm(game) do
    # 1. Write to segment
    {:ok, {segment_id, wal_id}} = Blunderfest.Segment.write(game)
    
    # 2. Wait for WAL to be applied (synchronous)
    wait_for_wal_apply(wal_id, 5000)
    
    # 3. Force hot index update
    Blunderfest.PositionIndex.force_sync()
    
    # 4. Read back to confirm
    {:ok, confirmed_game} = Blunderfest.Game.get(game.id)
    
    {:ok, confirmed_game}
  end
  
  defp wait_for_wal_apply(wal_id, timeout_ms) do
    start = System.system_time(:millisecond)
    
    Enum.reduce_while(0..100, nil, fn _, _ ->
      if System.system_time(:millisecond) - start > timeout_ms do
        {:halt, {:error, :timeout}}
      else
        case WAL.get(wal_id) do
          %{applied: true} -> {:halt, :ok}
          _ -> 
            Process.sleep(50)
            {:cont, nil}
        end
      end
    end)
  end
end
```

### Cross-Shard Queries

Some queries span multiple shards:

```elixir
defmodule Blunderfest.Distributed.ScatterGather do
  @moduledoc """
  Execute queries across multiple shards.
  """
  
  @spec search_games(GameSearchParams.t()) :: [Game.t()]
  def search_games(params) do
    # Get all active nodes
    nodes = NodeRegistry.active_nodes()
    
    # Scatter query to all nodes
    tasks = Enum.map(nodes, fn node ->
      Task.Supervisor.async({Blunderfest.TaskSupervisor, node}, fn ->
        # Execute query on remote node
        Blunderfest.Search.execute_remotely(params)
      end)
    end)
    
    # Gather results
    tasks
    |> Task.yield_many(30_000)  # 30 second timeout
    |> Enum.flat_map(fn {_task, result} ->
      case result do
        {:ok, games} -> games
        {:exit, _} -> []
        nil -> []  # Timeout
      end
    end)
    |> deduplicate_and_sort()
  end
  
  defp deduplicate_and_sort(games) do
    games
    |> Enum.uniq_by(& &1.id)
    |> Enum.sort_by(&{-&1.relevance, &1.date}, :asc)
  end
end
```

## Failure Handling

### Node Failure Detection

```elixir
defmodule Blunderfest.Distributed.Heartbeat do
  @moduledoc """
  Heartbeat monitoring for node health.
  """
  
  use GenServer
  
  @check_interval 5_000  # 5 seconds
  @timeout 30_000  # 30 seconds
  
  defstruct [:timer, :nodes]
  
  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end
  
  @impl true
  def init(_opts) do
    schedule_check()
    {:ok, %__MODULE__{}}
  end
  
  defp schedule_check do
    Process.send_after(self(), :check, @check_interval)
  end
  
  @impl true
  def handle_info(:check, state) do
    check_all_nodes()
    schedule_check()
    {:noreply, state}
  end
  
  defp check_all_nodes do
    NodeRegistry.all_nodes()
    |> Enum.each(fn node ->
      case :rpc.call(node, Blunderfest.Health, :ping, [], @timeout) do
        {:ok, _} ->
          NodeRegistry.update_status(node.node_id, :active)
        _ ->
          NodeRegistry.update_status(node.node_id, :inactive)
          handle_node_failure(node)
      end
    end)
  end
  
  defp handle_node_failed(node) do
    # 1. Update node status
    NodeRegistry.update_status(node.node_id, :inactive)
    
    # 2. Reassign shards to other nodes
    ShardMap.reassign_shards(node.node_id)
    
    # 3. Rebuild hot indexes on new nodes
    Task.Supervisor.async_nolink(Blunderfest.TaskSupervisor, fn ->
      ShardMap.rebuild_indexes(node.node_id)
    end)
    
    # 4. Log incident
    Logger.warning("Node #{node.node_id} marked as inactive")
  end
end
```

### Shard Reassignment

```elixir
defmodule Blunderfest.Distributed.ShardReassignment do
  @moduledoc """
  Handle shard reassignment when nodes fail.
  """
  
  @spec reassign_shards(String.t()) :: :ok
  def reassign_shards(failed_node_id) do
    # Get shards owned by failed node
    shards = ShardMap.get_shards_by_node(failed_node_id)
    
    # Get available nodes
    available_nodes = NodeRegistry.active_nodes()
                    |> Enum.filter(&(&1.role == :storage))
    
    # Distribute shards evenly
    shards
    |> Enum.with_index()
    |> Enum.each(fn {shard, idx} ->
      target_node = Enum.at(available_nodes, rem(idx, length(available_nodes)))
      
      # Initiate transfer
      initiate_transfer(shard, target_node)
    end)
  end
  
  defp initiate_transfer(shard, target_node) do
    # 1. Mark shard as migrating
    ShardMap.update_status(shard.shard_id, :migrating)
    
    # 2. Copy segment files
    source_segments = ShardMap.get_segments(shard.shard_id)
    
    Enum.each(source_segments, fn segment ->
      S3.copy(segment, target_node)
    end)
    
    # 3. Sync hot indexes
    Task.Supervisor.async({Blunderfest.TaskSupervisor, target_node}, fn ->
      IndexRebuilder.rebuild_from_segments(source_segments)
    end)
    
    # 4. Update shard map
    ShardMap.assign_shard(shard.shard_id, target_node.node_id)
    
    # 5. Mark complete
    ShardMap.update_status(shard.shard_id, :active)
  end
end
```

### Recovery Procedures

#### Crash During Write

```
1. Detect crash (heartbeat timeout)
2. On restart:
   a. Run segment integrity check
   b. Truncate any partial writes (CRC validation)
   c. Replay unapplied WAL entries
   d. Verify hot index consistency
3. Resume normal operation
```

#### Index Corruption

```
1. Detect via CRC mismatch
2. Mark shard as degraded
3. Initiate rebuild:
   a. Read all segments from S3
   b. Rebuild position index
   c. Rebuild player index
   d. Rebuild opening index
4. Atomic swap to new index
5. Delete corrupted index
```

## Replication

### Read Replicas

```elixir
defmodule Blunderfest.Distributed.Replication do
  @moduledoc """
  Asynchronous replication to read replicas.
  """
  
  @replication_lag_target_ms 5_000
  
  @spec replicate_to_replicas(String.t(), segment_data()) :: :ok
  def replicate_to_replicas(segment_id, data) do
    replicas = NodeRegistry.nodes_with_role(:replica)
    
    Enum.each(replicas, fn replica ->
      Task.Supervisor.async_nolink(Blunderfest.TaskSupervisor, fn ->
        replicate_segment(replica, segment_id, data)
      end)
    end)
    
    :ok
  end
  
  defp replicate_segment(replica, segment_id, data) do
    # Stream segment to replica
    with {:ok, _} <- :rpc.call(replica, Blunderfest.Segment, :receive, [segment_id, data]) do
      Logger.info("Replicated #{segment_id} to #{replica.node_id}")
    else
      error ->
        Logger.error("Failed to replicate #{segment_id} to #{replica.node_id}: #{inspect(error)}")
        # Will retry on next heartbeat check
    end
  end
end
```

### Consistency Levels

| Level | Description | Use Case |
|-------|-------------|----------|
| `eventual` | May see stale data for up to 5s | Position stats, opening stats |
| `bounded` | Stale data within SLA (e.g., 5s) | Search results |
| `strong` | Always consistent | Write confirmation |

## Monitoring

### Key Metrics

```elixir
defmodule Blunderfest.Distributed.Metrics do
  @moduledoc """
  Metrics for distributed system health.
  """
  
  defstruct [
    :replication_lag_ms,
    :active_nodes,
    :shards_per_node,
    :write_throughput,
    :read_throughput
  ]
  
  @spec collect() :: t()
  def collect do
    %__MODULE__{
      replication_lag_ms: measure_replication_lag(),
      active_nodes: count_active_nodes(),
      shards_per_node: avg_shards_per_node(),
      write_throughput: measure_write_throughput(),
      read_throughput: measure_read_throughput()
    }
  end
  
  defp measure_replication_lag do
    # Compare WAL sequence on primary vs replicas
    case Postgrex.query!(pool(), """
      SELECT 
        primary_lsn - MAX(lsn)
      FROM pg_stat_replication
    """) do
      %{rows: [[nil]]} -> 0
      %{rows: [[lag]]} -> lag  # in bytes, convert to time estimate
    end
  end
end
```

## Implementation Checklist

- [ ] Implement consistent hashing ring
- [ ] Add PostgreSQL schema for shard_map and node_registry
- [ ] Implement WAL with PostgreSQL
- [ ] Add advisory lock for segment writes
- [ ] Implement heartbeat monitoring
- [ ] Add shard reassignment on failure
- [ ] Implement read replicas
- [ ] Add scatter-gather for cross-shard queries
- [ ] Write runbook for failure scenarios
- [ ] Load test with simulated failures

## References

- See `15-storage-architecture.md` for hot/cold storage details
- See `04-scalability-performance.md` for performance targets
- See `05-deployment-guide.md` for deployment configuration
