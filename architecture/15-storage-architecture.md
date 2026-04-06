# Storage Architecture

## Overview

This document supersedes the storage architecture described in previous documents. It addresses the critical issues identified during review regarding the S3/memory-mapping contradiction and provides a production-ready hot/cold storage architecture.

## Critical Issue: Why S3 + Memory-Mapping Doesn't Work

### The Contradiction

Previous documents described:
- Memory-mapped files for fast random access
- Shared S3/MinIO storage for distributed nodes

**These are fundamentally incompatible:**

| Approach | Characteristics | Works with S3? |
|----------|-----------------|----------------|
| Memory-mapping | Requires local filesystem with byte-range access | ❌ No |
| S3/MinIO | Object storage with PUT/GET operations | ✅ Yes |
| Memory-mapping S3 | Would require fetching entire file or complex caching | ❌ No |

### Why S3 Cannot Be Memory-Mapped

1. **No byte-range guarantees** - S3 provides eventual consistency, not byte-level access
2. **Latency** - S3 operations are 10-100ms, memory access is <1µs
3. **Cost** - Random S3 access is expensive; memory-mapping implies many reads
4. **Concurrency** - Multiple nodes cannot safely memory-map the same file

## Hot/Cold Storage Architecture

```
+------------------------------------------------------------------+
|                     Storage Architecture                          |
+------------------------------------------------------------------+
|                                                                  |
|  +------------------+        +------------------+               |
|  |   HOT STORAGE    |        |   COLD STORAGE   |               |
|  |   (Local SSD)    |        |   (S3/MinIO)    |               |
|  +------------------+        +------------------+               |
|         |                            |                           |
|  +------v------+              +------v------+                   |
|  | Position    |              | Game Data   |                   |
|  | Index       |              | Segments    |                   |
|  | (mmap)      |              | (append)    |                   |
|  +-------------+              +-------------+                   |
|  | Player      |              | Backups     |                   |
|  | Index       |              +-------------+                   |
|  +-------------+                                              |
|  | Opening     |              +------------------+            |
|  | Index       |              | META STORAGE    |            |
|  +-------------+              | (PostgreSQL)    |            |
|  | Query       |              +------------------+            |
|  | Cache       |                      |                        |
|  +-------------+              +------v------+                 |
|         |                     | Shard Map    |                 |
|         |                     | (which nodes |
|         +-------------------->+ own what)    |                 |
|                               +-------------+                   |
|                                                                  |
+------------------------------------------------------------------+
```

### Hot Storage Layer (Local NVMe SSD)

Stored on each node's local fast storage:

| Component | Format | Access Pattern | Size Estimate |
|-----------|--------|----------------|--------------|
| Position Index | Custom B-Tree + Zobrist hash | Random read, batch write | 2-8 GB |
| Player Index | ETS table | Random read/write | 1-2 GB |
| Opening Index | ETS table | Random read/write | 100 MB |
| Query Cache | LRU cache | Random read/write | 4-8 GB |
| Bloom Filter | In-memory bitmap | Random read, batch write | 10-50 MB |

**Benefits:**
- Sub-millisecond access times
- Full mmap control
- No network latency
- Predictable performance

### Cold Storage Layer (S3/MinIO)

Stored in object storage:

| Component | Format | Access Pattern | Notes |
|-----------|--------|----------------|-------|
| Game Segments | Append-only .bchess files | Sequential reads | 100K-1M games per segment |
| Position Archive | Archived index entries | Rare access | For historical analysis |
| Backups | Complete .bchess copies | Disaster recovery | Daily/weekly |
| Exports | PGN, JSON dumps | User-initiated | On-demand |

**Benefits:**
- Unlimited horizontal scale
- Built-in replication
- Cost-effective for cold data
- Independent of node failures

### Metadata Storage (PostgreSQL/SQLite)

For cluster coordination:

| Data | Storage | Why |
|------|---------|-----|
| Shard map | PostgreSQL | ACID transactions for consistency |
| Node registry | PostgreSQL | Centralized discovery |
| Write-ahead log | PostgreSQL | Recovery from crashes |
| API keys | PostgreSQL | Fast authentication |
| Usage metrics | PostgreSQL | Billing and monitoring |

## Append-Only Segment Design

### Why Append-Only?

Previous documents had underspecified write coordination. Append-only design solves this:

1. **No in-place updates** - Eliminates race conditions
2. **Crash-safe** - Partial writes are either complete or nonexistent
3. **Lock-free reads** - Readers never block writers
4. **Easy compaction** - Merge segments without rewriting history

### Segment Structure

```
+------------------------------------------------------------------+
|                     Segment File (.bchessseg)                     |
+------------------------------------------------------------------+
|  Header (64 bytes)                                                |
|  +------------------------------------------------------------+  |
|  | Magic: "BCS2" (4) | Version (2) | Flags (2) | Reserved (56) |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  String Table (variable)                                          |
|  +------------------------------------------------------------+  |
|  | Entry Count | Entry 1 (len + string) | Entry 2 | ...        |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  Games (append-only)                                             |
|  +------------------------------------------------------------+  |
|  | Game 1: magic + length + data + checksum                    |  |
|  | Game 2: magic + length + data + checksum                    |  |
|  | ...                                                          |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  Footer (32 bytes)                                                |
|  +------------------------------------------------------------+  |
|  | Magic: "BCSE" (4) | CRC32 (4) | Game Count (4) | Reserved  |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

### Write Flow

```
Application
    |
    v
+------------------+
| Serialize Game   | --> Validate, encode moves, build record
+------------------+
    |
    v
+------------------+
| Write to Segment | --> Append to local segment file (no locks)
+------------------+
    |
    v
+------------------+
| Update WAL       | --> PostgreSQL: record intent to sync
+------------------+
    |
    v
+------------------+
| Fsync + Index    | --> Force write to disk, update hot indexes
+------------------+
    |
    v
+------------------+
| Background Sync  | --> Batch upload to S3 (eventual consistency)
+------------------+
```

### Compaction

```
Segment_001 (1M games) ──┐
Segment_002 (1M games) ──┼── Merge ──> Segment_003 (2M games, compacted)
Segment_003 (500K games) ─┘
       │
       v
  Deleted games removed
  Redundant positions merged
  Index rebuilt incrementally
```

## Index Architecture

### Position Index (Hot Storage)

```
+------------------------------------------------------------------+
|                     Position Index (Hot)                          |
+------------------------------------------------------------------+
|                                                                   |
|  +------------------+                                             |
|  |  Bloom Filter    |  50 MB - Quick existence check             |
|  +------------------+                                             |
|          |                                                        |
|          v                                                        |
|  +------------------+                                             |
|  |  Hash Table      |  4 GB - Zobrist hash -> entry pointer      |
|  |  (ETS, mmap)    |  64-bit hash, open addressing              |
|  +------------------+                                             |
|          |                                                        |
|          v                                                        |
|  +------------------+                                             |
|  |  Entry Store     |  2 GB - Position entries                   |
|  |  (mmap file)     |  game_count, stats, game_ids (delta)      |
|  +------------------+                                             |
|                                                                   |
+------------------------------------------------------------------+
```

### Index Entry Structure

```elixir
defmodule Blunderfest.Storage.PositionIndexEntry do
  @typedoc """
  Position index entry stored in memory-mapped file.
  Fixed size: 32 bytes per entry for predictable access.
  """
  @enforce_keys [:hash, :offset, :count, :stats, :game_ids_offset]
  defstruct [:hash, :offset, :count, :stats, :game_ids_offset]
  
  @bit_size 32
  
  @type t :: %__MODULE__{
    hash: <<_::64>>,                    # Zobrist hash (8 bytes)
    offset: non_neg_integer(),         # Offset to game IDs (4 bytes)
    count: non_neg_integer(),          # Number of games (4 bytes)
    stats: <<_::32>>,                  # Packed stats (4 bytes)
    game_ids_offset: non_neg_integer() # Offset in game IDs section (4 bytes)
  }
  
  # Stats packing: white_wins (10 bits) + black_wins (10 bits) + draws (12 bits)
  def pack_stats(white_wins, black_wins, draws) do
    white_wins &&& 0x3FF
    |> bor((black_wins &&& 0x3FF) <<< 10)
    |> bor((draws &&& 0xFFF) <<< 20)
  end
  
  def unpack_stats(packed) do
    {
      white_wins: band(packed, 0x3FF),
      black_wins: band(packed >>> 10, 0x3FF),
      draws: band(packed >>> 20, 0xFFF)
    }
  end
end
```

### Memory-Mapped File Implementation

```elixir
defmodule Blunderfest.Storage.MemoryMappedFile do
  @moduledoc """
  Memory-mapped file access for hot indexes.
  Uses a NIF for true mmap support (not :file.read_file).
  """
  
  use GenServer
  
  @type t :: %__MODULE__{
    path: Path.t(),
    fd: :file.fd(),
    size: non_neg_integer(),
    ref: reference()  # mmap reference from NIF
  }
  
  defstruct [:path, :fd, :size, :ref]
  
  @spec open(Path.t()) :: {:ok, t()} | {:error, term()}
  def open(path) do
    with {:ok, fd} <- :file.open(path, [:raw, :binary, :read, :write]),
         {:ok, size} <- file_size(fd) do
      # Use NIF for actual mmap
      {:ok, ref} = :blunderfest_nif.mmap_open(path, 0, size, [:read, :write])
      
      {:ok, %__MODULE__{
        path: path,
        fd: fd,
        size: size,
        ref: ref
      }}
    end
  end
  
  @spec read(t(), non_neg_integer(), non_neg_integer()) :: binary()
  def read(%__MODULE__{ref: ref}, offset, length) do
    :blunderfest_nif.mmap_read(ref, offset, length)
  end
  
  @spec write(t(), non_neg_integer(), binary()) :: :ok | {:error, term()}
  def write(%__MODULE__{ref: ref}, offset, data) do
    :blunderfest_nif.mmap_write(ref, offset, data)
  end
  
  @spec sync(t()) :: :ok | {:error, term()}
  def sync(%__MODULE__{ref: ref}) do
    :blunderfest_nif.mmap_sync(ref)
  end
  
  @spec close(t()) :: :ok
  def close(%__MODULE__{fd: fd, ref: ref}) do
    :blunderfest_nif.mmap_close(ref)
    :file.close(fd)
  end
end
```

## NIF Integration Plan

### Why NIFs Are Required

Pure Elixir cannot meet the <1ms position lookup target:

| Operation | Elixir (µs) | NIF (µs) | Speedup |
|-----------|-------------|----------|---------|
| Zobrist hash | 50 | 2 | 25x |
| Binary parse | 200 | 10 | 20x |
| Index lookup | 100 | 1 | 100x |

### NIF Architecture (Rustler)

```
apps/blunderfest_core/
├── native/
│   └── blunderfest_nif/
│       ├── Cargo.toml
│       ├── src/
│       │   ├── lib.rs
│       │   ├── mmap.rs      # Memory mapping
│       │   ├── zobrist.rs   # Zobrist hashing
│       │   ├── binary.rs    # Binary format parsing
│       │   └── index.rs     # B-Tree operations
│       └── tests/
```

### Priority NIF Implementations

1. **mmap** - Essential for hot storage
2. **Zobrist hashing** - Critical path for position lookup
3. **Binary serialization** - Game read/write performance
4. **B-Tree operations** - Index management

## Cache Invalidation Strategy

### L1 Cache (ETS)

```elixir
defmodule Blunderfest.Cache.L1 do
  @moduledoc """
  LRU cache for hot positions using ETS.
  """
  
  use GenServer
  alias __MODULE__
  
  @type entry :: %{data: term(), accessed: non_neg_integer(), size: non_neg_integer()}
  
  defstruct [:table, :max_size, :max_memory, :current_memory]
  
  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end
  
  @impl true
  def init(opts) do
    table = :ets.new(__MODULE__, [
      :set,
      :public,
      :named_table,
      {:read_concurrency, true},
      {:write_concurrency, true}
    ])
    
    state = %__MODULE__{
      table: table,
      max_size: Keyword.get(opts, :max_entries, 1_000_000),
      max_memory: Keyword.get(opts, :max_memory_bytes, 8_000_000_000),
      current_memory: 0
    }
    
    schedule_cleanup()
    {:ok, state}
  end
  
  @spec get(any()) :: term() | nil
  def get(key) do
    case :ets.lookup(__MODULE__, key) do
      [{^key, entry}] ->
        # Update access time (touch for LRU)
        :ets.insert(__MODULE__, {key, %{entry | accessed: timestamp()}})
        entry.data
      [] ->
        nil
    end
  end
  
  @spec put(any(), term(), non_neg_integer()) :: :ok
  def put(key, data, size_bytes) do
    GenServer.cast(__MODULE__, {:put, key, data, size_bytes})
  end
  
  @impl true
  def handle_cast({:put, key, data, size_bytes}, state) do
    # Evict if necessary
    state = maybe_evict(state, size_bytes)
    
    :ets.insert(state.table, {key, %{
      data: data,
      accessed: timestamp(),
      size: size_bytes
    }})
    
    {:noreply, %{state | current_memory: state.current_memory + size_bytes}}
  end
  
  # Evict least recently used entries until we have space
  defp maybe_evict(state, needed_bytes) do
    if state.current_memory + needed_bytes > state.max_memory do
      evict_lru(state, needed_bytes)
    else
      state
    end
  end
  
  defp evict_lru(state, _needed_bytes) do
    # Get all entries sorted by access time
    entries = :ets.tab2list(state.table)
    sorted = Enum.sort_by(entries, fn {_, e} -> e.accessed end)
    
    # Evict oldest entries
    {evicted, remaining} = Enum.split_while(sorted, fn {_, e} ->
      state.current_memory - e.size > state.max_memory
    end)
    
    Enum.each(evicted, fn {key, entry} ->
      :ets.delete(__MODULE__, key)
    end)
    
    new_memory = Enum.reduce(remaining, 0, fn {_, e}, acc -> acc + e.size end)
    %{state | current_memory: new_memory}
  end
  
  defp timestamp, do: System.system_time(:millisecond)
  
  defp schedule_cleanup do
    Process.send_after(self(), :cleanup, 60_000)  # Every minute
  end
  
  @impl true
  def handle_info(:cleanup, state) do
    # Periodic cleanup of stale entries
    now = timestamp()
    timeout = :timer.minutes(30)  # 30 minute TTL
    
    :ets.foldl(fn {key, entry}, acc ->
      if now - entry.accessed > timeout do
        :ets.delete(__MODULE__, key)
        acc - entry.size
      else
        acc
      end
    end, state.current_memory, __MODULE__)
    
    schedule_cleanup()
    {:noreply, state}
  end
end
```

### L2 Cache (Memory-Mapped File)

```elixir
defmodule Blunderfest.Cache.L2 do
  @moduledoc """
  L2 cache backed by memory-mapped files.
  Persists across restarts, slower than L1.
  """
  
  use GenServer
  
  defstruct [:mmap, :index]
  
  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end
  
  @impl true
  def init(opts) do
    cache_dir = Keyword.get(opts, :cache_dir, "/var/lib/blunderfest/cache")
    cache_size = Keyword.get(opts, :cache_size, 16_000_000_000)  # 16 GB
    
    File.mkdir_p!(cache_dir)
    
    {:ok, mmap} = MemoryMappedFile.open(
      Path.join(cache_dir, "l2_cache.dat")
    )
    
    {:ok, index} = MemoryMappedFile.open(
      Path.join(cache_dir, "l2_index.dat")
    )
    
    {:ok, %__MODULE__{mmap: mmap, index: index}}
  end
  
  @spec get(any()) :: term() | nil
  def get(key) do
    GenServer.call(__MODULE__, {:get, key})
  end
  
  @impl true
  def handle_call({:get, key}, _from, state) do
    # Look up in index, then fetch from mmap
    case lookup_index(state.index, key) do
      {:ok, offset, size} ->
        data = MemoryMappedFile.read(state.mmap, offset, size)
        {:reply, :erlang.binary_to_term(data), state}
      :error ->
        {:reply, nil, state}
    end
  end
  
  defp lookup_index(index, key) do
    # Binary search in mmap'd index
    # Returns {offset, size} if found
    :undefined
  end
end
```

## Distributed Coordination

### Shard Map (PostgreSQL)

```sql
CREATE TABLE shard_map (
  shard_id    TEXT PRIMARY KEY,
  node_id     TEXT NOT NULL,
  segment_ids TEXT[] NOT NULL,  -- Segments owned by this shard
  game_count  BIGINT DEFAULT 0,
  position_count BIGINT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE node_registry (
  node_id      TEXT PRIMARY KEY,
  host         TEXT NOT NULL,
  port         INTEGER NOT NULL,
  role         TEXT NOT NULL,  -- 'api', 'analysis', 'storage'
  status       TEXT DEFAULT 'active',
  last_seen    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE write_ahead_log (
  id          SERIAL PRIMARY KEY,
  segment_id  TEXT NOT NULL,
  operation   TEXT NOT NULL,  -- 'append_game', 'compact'
  payload     JSONB NOT NULL,
  applied     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

### Node Registration

```elixir
defmodule Blunderfest.Distributed.NodeRegistry do
  @moduledoc """
  Manages node registration and shard ownership.
  """
  
  use GenServer
  
  @spec register_node(String.t(), String.t(), integer(), atom()) :: :ok
  def register_node(node_id, host, port, role) do
    GenServer.call(__MODULE__, {:register, node_id, host, port, role})
  end
  
  @impl true
  def handle_call({:register, node_id, host, port, role}, _from, state) do
    # Register in PostgreSQL
    :ok = Postgrex.query!(
      state.pool,
      """
      INSERT INTO node_registry (node_id, host, port, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (node_id) DO UPDATE SET
        host = EXCLUDED.host,
        port = EXCLUDED.port,
        role = EXCLUDED.role,
        last_seen = NOW()
      """,
      [node_id, host, port, Atom.to_string(role)]
    )
    
    {:reply, :ok, state}
  end
  
  @spec get_shard_nodes(String.t()) :: [node_info()]
  def get_shard_nodes(shard_id) do
    # Query shard map, return nodes that own this shard
  end
end
```

## Failure Recovery

### Crash During Write

```
1. Node crashes mid-write
2. Segment file has partial game at end
3. On restart:
   a. Read segment footer (CRC check)
   b. If footer invalid, truncate to last valid game
   c. Replay WAL entries marked as unapplied
4. Verify index consistency
5. Resume normal operation
```

### Index Corruption

```
1. Detect via CRC mismatch
2. Mark shard as degraded
3. Rebuild index from segment files (background)
4. Serve from segment files during rebuild
5. Swap to rebuilt index atomically
```

### Full Node Failure

```
1. Detect via heartbeat timeout
2. Other nodes mark shard as unavailable
3. Promote replica node for writes
4. Serve reads from S3 backup
5. Recover local hot storage from S3 (parallel)
```

## Implementation Checklist

- [ ] Implement NIF mmap wrapper (Rustler)
- [ ] Implement NIF Zobrist hashing
- [ ] Update binary format to segment-based
- [ ] Add segment compaction logic
- [ ] Implement L1/L2 cache with invalidation
- [ ] Add PostgreSQL schema for coordination
- [ ] Implement node registration
- [ ] Add WAL for crash recovery
- [ ] Write recovery procedures
- [ ] Benchmark hot/cold performance

## Performance Targets (Revised)

| Operation | Hot Storage | Cold Storage | Notes |
|-----------|------------|--------------|-------|
| Position lookup | < 0.5ms | < 50ms | L1 cache hit vs S3 |
| Game retrieval | < 2ms | < 100ms | Segment read |
| Write throughput | 10K games/sec | 1K games/sec | Local vs batch S3 |
| Index rebuild | < 1 min/1M games | N/A | Incremental |

## References

- See `02-binary-format-specification.md` for segment file format
- See `04-scalability-performance.md` for caching strategy
- See `11-uci-integration.md` for analysis storage
