# Search Algorithm Documentation

## Overview

This document details the search algorithms used in Blunderfest for position queries, game searches, and complex multi-criteria filtering. It covers query planning, index intersection strategies, result caching, and optimization techniques.

## Search Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Search Architecture                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │   Query     │────▶│   Query    │────▶│   Result    │       │
│  │  Request    │     │  Planner   │     │   Cache     │       │
│  └─────────────┘     └──────┬──────┘     └──────┬──────┘       │
│                              │                     │              │
│                              v                     │              │
│  ┌─────────────┐     ┌──────┴──────┐              │              │
│  │   Index     │◀────│   Index     │              │              │
│  │   Cache     │     │ Intersection│──────────────┘              │
│  └──────┬──────┘     └──────┬──────┘                            │
│         │                   │                                    │
│         │          ┌────────┴────────┐                          │
│         │          │                 │                          │
│         v          v                 v                          │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐                   │
│  │ Position  │  │   Game    │  │  Player   │                   │
│  │  Index    │  │   Index   │  │   Index   │                   │
│  └───────────┘  └───────────┘  └───────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 1. Query Types

### 1.1 Position Search

**Types:**
- Exact position lookup (by Zobrist hash)
- Position pattern matching
- Material configuration search
- Similar position search

### 1.2 Game Search

**Types:**
- Single criterion (player, event, date)
- Multi-criteria (combinations)
- Full-text search (player names, events)
- Time-range filters

### 1.3 Opening Search

**Types:**
- ECO code lookup
- Opening tree traversal
- Move sequence matching

## 2. Position Search Algorithm

### 2.1 Exact Position Lookup

```
Algorithm: Position_Lookup(fen)
─────────────────────────────────────
Input: FEN string
Output: Position statistics and game list

1. Parse FEN → Zobrist hash (H)
2. Check bloom filter:
   - If not in bloom → return empty result
3. Check L1 cache:
   - If found → return cached stats
4. Look up in position index:
   - Binary search by hash H
5. If found:
   - Fetch statistics
   - Fetch game IDs (delta-encoded)
   - Decode game IDs
6. Return stats and game list
```

```elixir
defmodule Blunderfest.Search.Position do
  @moduledoc """
  Exact position search implementation.
  """
  
  @spec lookup(t(), String.t(), keyword()) :: {:ok, position_result()} | {:error, term()}
  def lookup(searcher, fen, opts \\ []) do
    with {:ok, hash} <- Zobrist.hash_from_fen(fen),
         :ok <- BloomFilter.might_contain?(searcher.bloom_filter, hash),
         {:ok, cached} <- Cache.get(searcher.cache, hash) do
      {:ok, cached}
    else
      {:error, :not_in_bloom} ->
        {:ok, empty_result()}
        
      nil ->
        # Cache miss - query index
        case PositionIndex.find(searcher.position_index, hash) do
          {:ok, entry} ->
            stats = compute_stats(entry)
            game_ids = decode_game_ids(entry.game_ids)
            
            result = %{stats: stats, games: game_ids}
            
            # Cache the result (async)
            Task.start(fn -> Cache.put(searcher.cache, hash, result) end)
            
            {:ok, result}
            
          {:error, :not_found} ->
            {:ok, empty_result()}
        end
    end
  end
  
  defp compute_stats(entry) do
    %{
      game_count: entry.count,
      white_wins: entry.stats.white_wins,
      black_wins: entry.stats.black_wins,
      draws: entry.stats.draws,
      white_win_rate: entry.stats.white_wins / entry.count,
      draw_rate: entry.stats.draws / entry.count
    }
  end
end
```

### 2.2 Position Pattern Matching

```
Algorithm: Pattern_Match(pattern, board)
────────────────────────────────────────
Input: Board pattern (e.g., "R..K....r...k...")
       Wildcards: '.' = any piece
Output: List of matching positions

1. Parse pattern into constraint list
2. Generate all positions matching constraints
3. For each candidate:
   a. Calculate Zobrist hash
   b. Look up in position index
4. Return union of results
```

```elixir
defmodule Blunderfest.Search.PositionPattern do
  @moduledoc """
  Pattern-based position search.
  """
  
  @spec search(t(), pattern(), keyword()) :: {:ok, [position_result()]}
  def search(searcher, pattern, opts \\ []) do
    constraints = parse_pattern(pattern)
    
    # Generate candidate hashes
    candidates = generate_candidates(constraints)
    
    # Batch lookup in position index
    results = candidates
    |> Task.async_stream(fn hash ->
      PositionIndex.find(searcher.position_index, hash)
    end, max_concurrency: 100)
    |> Enum.flat_map(fn
      {:ok, {:ok, entry}} -> [entry]
      _ -> []
    end)
    
    {:ok, results}
  end
  
  defp parse_pattern(pattern) do
    # "R..K....r...k..."
    # → [{:piece, :white, :rook, 0},
    #    {:wildcard, 1},
    #    {:piece, :white, :king, 4}, ...]
    pattern
    |> String.graphemes()
    |> Enum.with_index()
    |> Enum.map(fn
      {"R", idx} -> {:piece, :white, :rook, idx}
      {"K", idx} -> {:piece, :white, :king, idx}
      {"r", idx} -> {:piece, :black, :rook, idx}
      {"k", idx} -> {:piece, :black, :king, idx}
      {".", idx} -> {:wildcard, idx}
      _ -> {:any, idx}
    end)
  end
end
```

### 2.3 Material Configuration Search

```elixir
defmodule Blunderfest.Search.Material do
  @moduledoc """
  Search by material configuration.
  """
  
  @spec search(t(), material_filter(), keyword()) :: {:ok, [position_result()]}
  def search(searcher, filter, opts \\ []) do
    %{white: white_pieces, black: black_pieces, exact: exact?} = filter
    
    # Build material signature
    white_sig = material_signature(white_pieces)
    black_sig = material_signature(black_pieces)
    
    # Scan position index (optimized for material patterns)
    scan_results = PositionIndex.scan_by_material(
      searcher.position_index,
      white_sig,
      black_sig,
      exact?: exact?
    )
    
    {:ok, scan_results}
  end
  
  defp material_signature(pieces) do
    pieces
    |> Enum.sort()
    |> Enum.map(&piece_to_value/1)
    |> Enum.reduce(0, fn v, acc -> acc * 10 + v end)
  end
  
  defp piece_to_value(:king), do: 0
  defp piece_to_value(:queen), do: 1
  defp piece_to_value(:rook), do: 2
  defp piece_to_value(:bishop), do: 3
  defp piece_to_value(:knight), do: 4
  defp piece_to_value(:pawn), do: 5
end
```

### 2.4 Similar Position Search

Uses vector similarity for fuzzy matching:

```elixir
defmodule Blunderfest.Search.SimilarPositions do
  @moduledoc """
  Find positions similar to a given position.
  Uses piece-square tables for vector representation.
  """
  
  # Piece-square values for similarity
  @piece_square_weights %{
    pawn:   [0,  0,  0,  0,  0,  0,  0,  0,
            50, 50, 50, 50, 50, 50, 50, 50,
            10, 10, 20, 30, 30, 20, 10, 10,
             5,  5, 10, 25, 25, 10,  5,  5,
             0,  0,  0, 20, 20,  0,  0,  0,
             5, -5,-10,  0,  0,-10, -5,  5,
             5, 10, 10,-20,-20, 10, 10,  5,
             0,  0,  0,  0,  0,  0,  0,  0],
    knight: [-50,-40,-30,-30,-30,-30,-40,-50,
             -40,-20,  0,  0,  0,  0,-20,-40,
             -30,  0, 10, 15, 15, 10,  0,-30,
             -30,  5, 15, 20, 20, 15,  5,-30,
             -30,  0, 15, 20, 20, 15,  0,-30,
             -30,  5, 10, 15, 15, 10,  5,-30,
             -40,-20,  0,  5,  5,  0,-20,-40,
             -50,-40,-30,-30,-30,-30,-40,-50],
    # ... other pieces
  }
  
  @spec find_similar(t(), String.t(), keyword()) :: {:ok, [similar_position()]}
  def find_similar(searcher, fen, opts \\ []) do
    threshold = Keyword.get(opts, :threshold, 0.8)
    limit = Keyword.get(opts, :limit, 50)
    
    # Calculate reference vector
    target_vector = position_to_vector(fen)
    
    # Scan nearby positions in index
    candidates = PositionIndex.scan_nearby(
      searcher.position_index,
      target_vector.hash,
      radius: 1000  # Hash neighborhood
    )
    
    # Calculate similarity and filter
    candidates
    |> Enum.map(fn entry ->
      vector = entry_to_vector(entry)
      similarity = cosine_similarity(target_vector, vector)
      {entry, similarity}
    end)
    |> Enum.filter(fn {_, sim} -> sim >= threshold end)
    |> Enum.sort_by(fn {_, sim} -> -sim end)
    |> Enum.take(limit)
    |> Enum.map(fn {entry, sim} -> %{entry: entry, similarity: sim} end)
    |> then(&{:ok, &1})
  end
  
  defp position_to_vector(fen) do
    board = Board.from_fen(fen)
    
    # Build 64-dimensional vector from piece-square tables
    vector = for sq <- 0..63 do
      case board.pieces[sq] do
        {color, piece} ->
          sign = if color == :white, do: 1, else: -1
          sign * Enum.at(@piece_square_weights[piece], sq)
        nil ->
          0
      end
    end
    
    hash = Zobrist.hash(board)
    %{vector: vector, hash: hash}
  end
  
  defp cosine_similarity(v1, v2) do
    dot = Enum.zip(v1.vector, v2.vector) |> Enum.map(fn {a, b} -> a * b end) |> Enum.sum()
    mag1 = :math.sqrt(Enum.reduce(v1.vector, 0, fn x, acc -> acc + x * x end))
    mag2 = :math.sqrt(Enum.reduce(v2.vector, 0, fn x, acc -> acc + x * x end))
    dot / (mag1 * mag2)
  end
end
```

## 3. Game Search Algorithm

### 3.1 Query Planner

```elixir
defmodule Blunderfest.Search.QueryPlanner do
  @moduledoc """
  Plans optimal execution strategy for game searches.
  """
  
  @type predicate :: %{
    field: atom(),
    operator: atom(),
    value: term()
  }
  
  @type query_plan :: %{
    predicates: [predicate()],
    index_choices: [{atom(), atom()}],
    estimated_cost: float(),
    execution_order: [:hint]
  }
  
  @spec plan([predicate()], t()) :: query_plan()
  def plan(predicates, searcher) do
    # Estimate selectivity for each predicate
    predicates_with_selectivity = Enum.map(predicates, fn pred ->
      selectivity = estimate_selectivity(pred, searcher)
      %{predicate: pred, selectivity: selectivity}
    end)
    
    # Sort by selectivity (most selective first)
    sorted = Enum.sort_by(predicates_with_selectivity, & &1.selectivity)
    
    # Choose indices based on sorted predicates
    index_choices = choose_indices(sorted, searcher)
    
    # Estimate total cost
    cost = estimate_cost(sorted, index_choices)
    
    %{
      predicates: Enum.map(sorted, & &1.predicate),
      index_choices: index_choices,
      estimated_cost: cost,
      execution_order: plan_execution_order(sorted, index_choices)
    }
  end
  
  defp estimate_selectivity(predicate, searcher) do
    case predicate do
      %{field: :white, operator: :eq, value: name} ->
        1.0 / (PlayerIndex.estimate_player_games(searcher.player_index, name) || 1000)
        
      %{field: :date, operator: :range} ->
        # Assume uniform distribution over dates
        {from, to} = predicate.value
        date_range = Date.diff(to, from)
        1.0 / max(date_range / 365, 1)
        
      %{field: :eco, operator: :eq} ->
        # ECO codes have varying popularity
        # A00 = rare, E00 = common
        0.001  # Default estimate
        
      %{field: :result, operator: :eq} ->
        0.33  # 1/3 of games have each result
        
      _ ->
        0.1  # Default estimate
    end
  end
  
  defp choose_indices(predicates_with_selectivity, searcher) do
    Enum.reduce(predicates_with_selectivity, [], fn %{predicate: pred}, choices ->
      case pred.field do
        :white -> [{:player_index, :white} | choices]
        :black -> [{:player_index, :black} | choices]
        :date -> [{:date_index, :date} | choices]
        :eco -> [{:eco_index, :eco} | choices]
        _ -> choices
      end
    end)
  end
  
  defp estimate_cost(predicates, index_choices) do
    base_cost = 1000.0  # Base cost for full scan
    
    # Reduce cost based on index usage
    index_reduction = length(index_choices) * 0.9
    
    # Reduce cost based on selectivity
    selectivity_factor = predicates
    |> Enum.map(& &1.selectivity)
    |> Enum.reduce(1.0, fn sel, acc -> acc * sel end)
    
    base_cost * (1 - index_reduction) * selectivity_factor
  end
end
```

### 3.2 Multi-Index Intersection

```elixir
defmodule Blunderfest.Search.IndexIntersection do
  @moduledoc """
  Intersect results from multiple indices.
  """
  
  @spec intersect([index_result()], keyword()) :: [game_id()]
  def intersect(results, opts \\ []) do
    strategy = Keyword.get(opts, :strategy, :sorted_merge)
    
    case strategy do
      :sorted_merge -> sorted_merge_intersection(results)
      :hash_join -> hash_join_intersection(results)
      :bloom_filter -> bloom_intersection(results)
    end
  end
  
  defp sorted_merge_intersection(results) do
    # Each result is sorted by game_id
    results
    |> Enum.reject(&Enum.empty?/1)
    |> Enum.sort_by(&length/1)  # Start with smallest
    |> case do
      [] -> []
      [smallest | rest] ->
        Enum.reduce(rest, Enum.to_list(smallest), fn result, acc ->
          merge_two_sorted(acc, Enum.to_list(result))
        end)
    end
  end
  
  defp merge_two_sorted([], b), do: b
  defp merge_two_sorted(a, []), do: a
  defp merge_two_sorted([ha | ta] = a, [hb | tb] = b) do
    cond do
      ha < hb -> [ha | merge_two_sorted(ta, b)]
      ha > hb -> [hb | merge_two_sorted(a, tb)]
      true -> [ha | merge_two_sorted(ta, tb)]
    end
  end
  
  defp hash_join_intersection(results) do
    # Build hash table from first result
    [first | rest] = results
    
    hash_table = first
    |> Enum.map(fn id -> {id, 1} end)
    |> Map.new()
    
    # Filter by remaining results
    Enum.reduce(rest, hash_table, fn result, acc ->
      Enum.reduce(result, acc, fn id, inner_acc ->
        Map.update(inner_acc, id, 0, &(&1 + 1))
      end)
    end)
    |> Enum.filter(fn {_, count} -> count == length(results) - 1 end)
    |> Enum.map(fn {id, _} -> id end)
  end
  
  defp bloom_intersection(results) do
    # Use bloom filters for probabilistic intersection
    # Very fast but may have false positives
    bloom = BloomFilter.new()
    
    results
    |> Enum.with_index()
    |> Enum.each(fn {result, idx} ->
      Enum.each(result, fn id ->
        # Simple hash-based bloom
        :ok = BloomFilter.add(bloom, <<id::32, idx::32>>)
      end)
    end)
    
    # Return potential matches (must verify)
    [first | _] = results
    Enum.filter(first, fn id ->
      Enum.all?(Enum.with_index(results), fn {result, idx} ->
        BloomFilter.might_contain?(bloom, <<id::32, idx::32>>)
      end)
    end)
  end
end
```

### 3.3 Full-Text Search

```elixir
defmodule Blunderfest.Search.FullText do
  @moduledoc """
  Full-text search for player names, events, etc.
  Uses trigram-based indexing for fuzzy matching.
  """
  
  @spec search(t(), String.t(), keyword()) :: {:ok, [player()]}
  def search(searcher, query, opts \\ []) do
    limit = Keyword.get(opts, :limit, 20)
    
    # Generate trigrams from query
    trigrams = generate_trigrams(String.downcase(query))
    
    # Find players with matching trigrams
    candidates = PlayerIndex.search_by_trigrams(
      searcher.player_index,
      trigrams
    )
    
    # Score and rank by relevance
    candidates
    |> Enum.map(fn player ->
      score = calculate_relevance(query, player.name, trigrams)
      {player, score}
    end)
    |> Enum.sort_by(fn {_, score} -> -score end)
    |> Enum.take(limit)
    |> Enum.map(fn {player, _} -> player end)
    |> then(&{:ok, &1})
  end
  
  defp generate_trigrams(text) do
    # Add padding and generate trigrams
    padded = "  " <> text <> "  "
    
    padded
    |> String.graphemes()
    |> Enum.chunk_every(3, 1)
    |> Enum.map(&Enum.join/1)
    |> Enum.uniq()
  end
  
  defp calculate_relevance(query, name, trigrams) do
    name_lower = String.downcase(name)
    name_trigrams = generate_trigrams(name_lower)
    
    # Jaccard similarity
    intersection = MapSet.intersection(
      MapSet.new(trigrams),
      MapSet.new(name_trigrams)
    )
    |> MapSet.size()
    
    union = MapSet.union(
      MapSet.new(trigrams),
      MapSet.new(name_trigrams)
    )
    |> MapSet.size()
    
    jaccard = intersection / union
    
    # Exact match bonus
    exact_bonus = if String.starts_with?(name_lower, query), do: 0.2, else: 0
    
    # Length penalty (shorter names rank higher for short queries)
    length_penalty = min(String.length(query) / String.length(name), 0.2)
    
    jaccard + exact_bonus - length_penalty
  end
end
```

## 4. Query Optimization

### 4.1 Predicate Reordering

```elixir
defmodule Blunderfest.Search.Optimizer do
  @moduledoc """
  Reorder predicates for optimal execution.
  """
  
  @spec optimize([predicate()], t()) :: [predicate()]
  def optimize(predicates, searcher) do
    predicates
    |> Enum.map(fn pred ->
      %{predicate: pred, cost: predicate_cost(pred, searcher)}
    end)
    |> Enum.sort_by(& &1.cost)
    |> Enum.map(& &1.predicate)
  end
  
  defp predicate_cost(predicate, searcher) do
    case predicate do
      %{field: :id, operator: :eq} ->
        # Direct ID lookup is cheapest
        1.0
        
      %{field: :hash, operator: :eq} ->
        # Position hash lookup
        2.0
        
      %{field: :eco} ->
        # ECO index is well-optimized
        10.0
        
      %{field: :white} when predicate.operator == :eq ->
        # Player lookup
        50.0
        
      %{field: :date, operator: :range} ->
        # Range query
        500.0
        
      %{field: :moves} ->
        # Full scan required
        10000.0
        
      _ ->
        1000.0
    end
  end
end
```

### 4.2 Query Result Caching

```elixir
defmodule Blunderfest.Search.Cache do
  @moduledoc """
  Cache for search results.
  """
  
  use GenServer
  
  @cache_ttl :timer.minutes(30)
  @max_cache_size 100_000
  
  defstruct [:cache, :hits, :misses]
  
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end
  
  @impl true
  def init(_opts) do
    cache = :ets.new(__MODULE__, [
      :set,
      :named_table,
      {:read_concurrency, true},
      {:write_concurrency, true}
    ])
    
    {:ok, %__MODULE__{cache: cache, hits: 0, misses: 0}}
  end
  
  @spec get_or_compute(keyword(), (() -> result())) :: result()
  def get_or_compute(params, compute_fn) do
    key = cache_key(params)
    
    case :ets.lookup(__MODULE__, key) do
      [{^key, result, timestamp}] ->
        if cache_fresh?(timestamp) do
          GenServer.cast(__MODULE__, :hit)
          result
        else
          compute_and_cache(key, compute_fn)
        end
        
      [] ->
        compute_and_cache(key, compute_fn)
    end
  end
  
  defp compute_and_cache(key, compute_fn) do
    GenServer.cast(__MODULE__, :miss)
    result = compute_fn.()
    
    :ets.insert(__MODULE__, {
      key,
      result,
      System.system_time(:millisecond)
    })
    
    result
  end
  
  defp cache_key(params) do
    # Normalize and hash params
    normalized = params
    |> Enum.sort()
    |> Enum.map(fn {k, v} -> {k, normalize_value(v)} end)
    
    :crypto.hash(:sha256, :erlang.term_to_binary(normalized))
  end
  
  defp normalize_value(v) when is_binary(v), do: String.downcase(String.trim(v))
  defp normalize_value(v), do: v
  
  defp cache_fresh?(timestamp) do
    System.system_time(:millisecond) - timestamp < @cache_ttl
  end
  
  @impl true
  def handle_cast(:hit, state) do
    %{hits: hits, misses: misses} = state
    new_hits = hits + 1
    
    # Log hit rate periodically
    if rem(new_hits, 10000) == 0 do
      hit_rate = new_hits / (new_hits + misses)
      Logger.info("Search cache hit rate: #{:erlang.float_to_binary(hit_rate, [{:decimals, 2}])}")
    end
    
    {:noreply, %{state | hits: new_hits}}
  end
  
  @impl true
  def handle_cast(:miss, state) do
    %{misses: misses} = state
    {:noreply, %{state | misses: misses + 1}}
  end
end
```

## 5. Search API

### 5.1 Unified Search Interface

```elixir
defmodule Blunderfest.Search do
  @moduledoc """
  Unified search interface.
  """
  
  @spec search(search_params()) :: {:ok, search_result()} | {:error, term()}
  def search(params) do
    with {:ok, plan} <- QueryPlanner.plan(params.predicates, searcher()),
         results <- execute_plan(plan) do
      {:ok, format_results(results, params)}
    end
  end
  
  @spec execute_plan(query_plan()) :: [game_id()]
  defp execute_plan(plan) do
    # Execute predicates in optimal order
    results = plan.predicates
    |> Enum.map(fn predicate ->
      execute_predicate(predicate, plan.index_choices)
    end)
    
    # Intersect results
    IndexIntersection.intersect(results)
  end
end
```

## 6. Performance Targets

| Search Type | Target | p95 | Notes |
|------------|--------|-----|-------|
| Position exact | < 1ms | 2ms | L1 cache hit |
| Position pattern | < 50ms | 100ms | Up to 1000 candidates |
| Material search | < 20ms | 50ms | Index scan |
| Similar positions | < 200ms | 500ms | Vector similarity |
| Game by ID | < 1ms | 5ms | Direct lookup |
| Single player filter | < 50ms | 100ms | Index lookup |
| Multi-criteria (3) | < 100ms | 200ms | Intersection |
| Full-text player | < 50ms | 100ms | Trigram index |
| Opening tree | < 20ms | 50ms | Cached tree |

## 7. Implementation Checklist

- [ ] Implement exact position lookup
- [ ] Implement position pattern matching
- [ ] Implement material configuration search
- [ ] Implement similar position search
- [ ] Build query planner with cost estimation
- [ ] Implement index intersection strategies
- [ ] Add full-text search with trigrams
- [ ] Implement result caching
- [ ] Add query optimization (predicate reordering)
- [ ] Benchmark all search types
- [ ] Document API and examples

## References

- See `02-binary-format-specification.md` for index structures
- See `04-scalability-performance.md` for caching strategy
- See `06-zobrist-hashing.md` for position hashing
