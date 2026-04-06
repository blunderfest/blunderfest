# Scalability and Performance

## Capacity Targets

### Single Node

| Metric | Target | Notes |
|--------|--------|-------|
| Max games | 100 million | Single database file |
| Max positions | 5 billion | Unique positions indexed |
| Concurrent queries | 10,000/sec | Read operations |
| Concurrent users | 10,000 | Active connections |
| Import speed | 1,000 games/sec | Bulk import |
| Database file size | 100 GB | Practical limit |
| Memory usage | 32 GB | Including caches |

### Distributed Cluster

| Metric | Target | Notes |
|--------|--------|-------|
| Max games | Billions | Across all nodes |
| Concurrent queries | 100,000/sec | Cluster-wide |
| Concurrent users | 100,000+ | Across all nodes |
| Nodes | 100+ | Horizontal scaling |
| Availability | 99.99% | With replication |

## Performance Benchmarks

### Position Operations

```
Operation                    Target      Notes
-------------------------    ------      -----
Exact position lookup        < 1ms       Indexed (Zobrist hash)
Position with stats          < 5ms       Including aggregation
Material filter search       < 50ms      Simple filter
Complex pattern search       < 100ms     Multiple criteria
Fuzzy position matching      < 500ms     Similarity search
Transposition lookup         < 10ms      All move orders
```

### Game Operations

```
Operation                    Target      Notes
-------------------------    ------      -----
Add game                     < 10ms      Including indexing
Get game by ID               < 5ms       Direct lookup
Search games                 < 100ms     Typical query
List games (paginated)       < 50ms      20 results
Delete game                  < 10ms      Including index update
Update game                  < 10ms      Metadata update
```

### Analysis Operations

```
Operation                    Target      Notes
-------------------------    ------      -----
Opening classification       < 5ms       Move list to ECO
Opening tree lookup          < 20ms      With statistics
Player statistics            < 50ms      Full profile
Engine analysis start        < 100ms     Queue and start
Engine analysis (depth 20)   < 5 sec     Depends on position
```

### Import/Export

```
Operation                    Target      Notes
-------------------------    ------      -----
PGN import                   > 1000/sec  Bulk import
PGN export                   > 500/sec   With annotations
JSON export                  > 1000/sec  Structured data
Database creation            < 1 sec     Empty database
Index rebuild                < 1 min     1 million games
```

## Memory Architecture

### Memory Layout (32 GB Node)

```
+----------------------------------+
|          Memory Layout           |
+----------------------------------+
| ETS Caches           8 GB        |
|  - Hot positions     4 GB        |
|  - Player cache      2 GB        |
|  - Opening cache     1 GB        |
|  - String table      1 GB        |
+----------------------------------+
| Memory-Mapped Files  16 GB       |
|  - Position index    8 GB        |
|  - Game data         6 GB        |
|  - Player index      2 GB        |
+----------------------------------+
| OS File Cache        6 GB        |
|  - Frequently read              |
|  - Disk buffering               |
+----------------------------------+
| Application          2 GB        |
|  - Process overhead             |
|  - Temporary buffers            |
+----------------------------------+
```

### Caching Strategy

```
+------------------+     +------------------+
|   L1: ETS Cache  | --> |   L2: MMap File  |
|   (Hot data)     |     |   (Warm data)    |
+------------------+     +------------------+
        |                        |
        v                        v
+------------------+     +------------------+
|  Hit Rate: 80%   |     |  Hit Rate: 95%   |
|  Latency: <1ms   |     |  Latency: <5ms   |
+------------------+     +------------------+
```

#### L1 Cache (ETS)

```elixir
# Hot position cache
:ets.new(:hot_positions, [:set, :public, :named_table, 
  {:write_concurrency, true}, 
  {:read_concurrency, true}])

# LRU eviction when full
defmodule Blunderfest.Cache.Positions do
  use GenServer
  
  @max_size 1_000_000
  
  def store(hash, data) do
    if cache_size() > @max_size do
      evict_lru()
    end
    :ets.insert(:hot_positions, {hash, data, System.system_time(:millisecond)})
  end
end
```

#### L2 Cache (Memory-Mapped)

```elixir
# Memory-mapped position index
defmodule Blunderfest.Storage.MMap do
  def open_index(path) do
    {:ok, fd} = :file.open(path, [:read, :binary])
    {:ok, size} = :file.position(fd, :eof)
    
    # Use Erlang's binary API for memory mapping
    {:ok, binary} = :file.read_file(path, [read_ahead: size])
    %{fd: fd, binary: binary, size: size}
  end
  
  def lookup(%{binary: binary}, offset, size) do
    :binary.part(binary, offset, size)
  end
end
```

## Indexing Strategy

### Position Index Structure

```
+------------------+
|  Bloom Filter    |  1 MB  - Quick existence check
+------------------+
|  Hash Table      |  8 GB  - Zobrist hash -> offset
+------------------+
|  B-Tree Index    |  2 GB  - Range queries
+------------------+
```

### Bloom Filter for Existence

```elixir
defmodule Blunderfest.Storage.BloomFilter do
  use GenServer
  
  @capacity 100_000_000
  @false_positive_rate 0.01
  
  def start_link(opts) do
    size = calculate_size(@capacity, @false_positive_rate)
    hashes = calculate_hashes(@false_positive_rate)
    
    GenServer.start_link(__MODULE__, %{
      bits: :array.new(size, fixed: true, default: 0),
      hash_count: hashes,
      capacity: @capacity
    }, opts)
  end
  
  defp calculate_size(n, p) do
    trunc(-n * :math.log(p) / (:math.log(2) ** 2))
  end
  
  defp calculate_hashes(p) do
    trunc(:math.log(2) * -n / :math.log(p))
  end
end
```

### Multi-Level Index

```
Level 1: In-memory hash table (hot positions)
    |
    v
Level 2: Memory-mapped B+ tree (warm positions)
    |
    v
Level 3: Compressed index on disk (cold positions)
```

## Concurrency Model

### Process Architecture

```
+------------------+
|  Supervisor      |
+------------------+
    |
    +---> Database Worker Pool (100 processes)
    |
    +---> Search Worker Pool (200 processes)
    |
    +---> Import Worker Pool (50 processes)
    |
    +---> Analysis Worker Pool (dynamic)
    |
    +---> Cache Manager
    |
    +---> Index Manager
```

### Worker Pool Configuration

```elixir
# Database worker pool
defmodule Blunderfest.Workers.Database do
  use Poolboy, [
    name: {:local, :db_workers},
    worker_module: Blunderfest.Workers.DatabaseWorker,
    size: 100,
    max_overflow: 50,
    strategy: :lifo
  ]
end

# Search worker pool
defmodule Blunderfest.Workers.Search do
  use Poolboy, [
    name: {:local, :search_workers},
    worker_module: Blunderfest.Workers.SearchWorker,
    size: 200,
    max_overflow: 100,
    strategy: :fifo
  ]
end
```

### Request Flow

```
Request --> Load Balancer --> API Process --> Worker Pool --> Database
    |                                                              |
    +--------------------------------------------------------------+
                              Async Response
```

## Distributed Architecture

### Consistent Hashing for Sharding

```elixir
defmodule Blunderfest.Distributed.Shard do
  @nodes [:node1, :node2, :node3, :node4]
  @rings 100  # Virtual nodes per physical node
  
  def shard_key(game_id) do
    :crypto.hash(:sha256, <<game_id::64>>)
    |> :binary.decode_unsigned()
    |> rem(length(@nodes) * @rings)
    |> div(@rings)
    |> then(&Enum.at(@nodes, &1))
  end
  
  def get_node(game_id) do
    node = shard_key(game_id)
    if Node.ping(node) == :pong do
      node
    else
      # Failover to next node
      failover_node(node)
    end
  end
end
```

### Replication Strategy

```
+------------------+
|   Primary Node   |
+------------------+
        |
        +---> Replica 1 (sync)
        |
        +---> Replica 2 (async)
        |
        +---> Replica 3 (async)
```

### Event Sourcing for Sync

```elixir
defmodule Blunderfest.Distributed.EventLog do
  defstruct [:sequence, :type, :data, :timestamp, :node]
  
  # Event types
  @event_types [:game_added, :game_updated, :game_deleted, 
                :index_updated, :stats_updated]
  
  def append_event(type, data) do
    event = %__MODULE__{
      sequence: get_next_sequence(),
      type: type,
      data: data,
      timestamp: System.system_time(:millisecond),
      node: Node.self()
    }
    
    persist_event(event)
    broadcast_event(event)
  end
end
```

## Optimization Techniques

### 1. Batch Operations

```elixir
# Batch game import
def batch_import(db, games, batch_size \\ 1000) do
  games
  |> Enum.chunk_every(batch_size)
  |> Enum.map(fn batch ->
    Task.async(fn -> 
      Blunderfest.Game.import_batch(db, batch)
    end)
  end)
  |> Task.await_many(30_000)
end
```

### 2. Parallel Index Building

```elixir
def build_index_parallel(db, games) do
  games
  |> Task.async_stream(fn game ->
    positions = extract_positions(game)
    Enum.map(positions, &index_position/1)
  end, max_concurrency: 50)
  |> Enum.to_list()
end
```

### 3. Compression

```elixir
# Move compression
def compress_moves(moves) do
  # Coordinate encoding: 2 bytes per move
  moves
  |> Enum.map(&encode_move/1)
  |> :erlang.term_to_binary()
  |> :zlib.gzip()
end

# Index compression with delta encoding
def compress_index(entries) do
  entries
  |> Enum.sort_by(& &1.hash)
  |> delta_encode()
  |> :zlib.gzip()
end
```

### 4. Query Optimization

```elixir
# Query planning
def optimize_query(query) do
  query
  |> estimate_cost()
  |> choose_index()
  |> reorder_predicates()
  |> add_limits()
end

defp estimate_cost(query) do
  # Estimate based on index selectivity
  Enum.reduce(query.filters, 1.0, fn filter, cost ->
    cost * selectivity(filter)
  end)
end
```

### 5. Prefetching

```elixir
# Prefetch related data
def prefetch_game_data(games) do
  player_ids = Enum.flat_map(games, &[&1.white_id, &1.black_id]) |> Enum.uniq()
  event_ids = Enum.map(games, & &1.event_id) |> Enum.uniq()
  
  players = Blunderfest.Player.get_by_ids(player_ids)
  events = Blunderfest.Event.get_by_ids(event_ids)
  
  %{
    games: games,
    players: Map.new(players, &{&1.id, &1}),
    events: Map.new(events, &{&1.id, &1})
  }
end
```

## Monitoring and Metrics

### Key Metrics

```elixir
# Telemetry events
:telemetry.execute(:blunderfest, [:query, :start], %{query: query})
:telemetry.execute(:blunderfest, [:query, :stop], %{
  duration: duration,
  result_count: count
})

# Metrics to track
@metrics [
  :query_latency,
  :query_count,
  :cache_hit_rate,
  :index_size,
  :database_size,
  :active_connections,
  :worker_pool_size,
  :import_speed,
  :error_rate
]
```

### Prometheus Metrics

```elixir
# Prometheus counters and gauges
defmodule Blunderfest.Metrics do
  use Prometheus.Metric
  
  counter(:blunderfest_queries_total, 
    "Total number of queries", 
    [:type, :status])
  
  histogram(:blunderfest_query_duration_seconds,
    "Query duration in seconds",
    [:type],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0])
  
  gauge(:blunderfest_cache_hit_rate,
    "Cache hit rate",
    [:cache_level])
  
  gauge(:blunderfest_database_size_bytes,
    "Database size in bytes")
end
```

## Performance Tuning

### Configuration Options

```elixir
# config/prod.exs
config :blunderfest,
  cache_size: 8_000_000_000,        # 8 GB cache
  max_workers: 200,                  # Max worker processes
  batch_size: 1000,                  # Batch import size
  index_memory_limit: 16_000_000_000, # 16 GB for indices
  query_timeout: 30_000,             # 30 second timeout
  import_parallelism: 50             # Parallel import workers
```

### BEAM VM Tuning

```bash
# VM arguments for production
+K true                              # Enable SMP
+S 4                                 # 4 schedulers
+sbwt very_long                      # Busy wait for better latency
+sdwt very_long
+swt very_low
MMsize 32G                           # 32 GB memory limit
+zdbtl 262144                        # Binary cache size
```

## Scaling Strategies

### Vertical Scaling

1. Add more RAM for caching
2. Use faster CPUs for computation
3. Use NVMe SSDs for storage
4. Increase network bandwidth

### Horizontal Scaling

1. Add more nodes to cluster
2. Shard data across nodes
3. Replicate for read scaling
4. Load balance requests

### Auto-Scaling

```elixir
defmodule Blunderfest.AutoScale do
  def check_and_scale do
    current_load = get_current_load()
    target_load = 0.7  # 70% target utilization
    
    if current_load > target_load do
      scale_up()
    elsif current_load < target_load * 0.5 do
      scale_down()
    end
  end
  
  defp scale_up do
    # Add more worker processes
    current = :poolboy.child_count(:db_workers)
    :poolboy.resize(:db_workers, current + 20)
  end
  
  defp scale_down do
    current = :poolboy.child_count(:db_workers)
    :poolboy.resize(:db_workers, max(current - 10, 50))
  end
end
```

## Performance Testing

### Benchmark Suite

```elixir
defmodule Blunderfest.Benchmarks do
  use Benchfella
  
  setup_all do
    {:ok, db} = Blunderfest.Database.open("test_db.bchess")
    {:ok, db: db}
  end
  
  bench "position lookup" do
    Blunderfest.Position.stats(db, "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3:0:0")
  end
  
  bench "game search" do
    Blunderfest.Search.games(db, white: "Carlsen", limit: 100)
  end
  
  bench "opening classification" do
    Blunderfest.Analysis.classify_opening(db, ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4"])
  end
end
```

### Load Testing

```elixir
# Using k6 or similar
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1000,
  duration: '5m',
};

export default function() {
  const res = http.get('https://api.blunderfest.com/v1/games?limit=20');
  check(res, { 'status was 200': (r) => r.status == 200 });
  sleep(1);
}