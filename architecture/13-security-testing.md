# Security and Testing Specification

## Security Specification

### Authentication and Authorization

**Choice: JWT vs. Session-based vs. API Keys**

We'll use **API Keys** for initial implementation with **JWT** for future user authentication.

**Rationale**:
- API keys are simpler for initial deployment
- JWT provides better scalability for user authentication
- Both can coexist during transition

### API Key Management

```elixir
defmodule Blunderfest.Auth.APIKey do
  @moduledoc """
  API key management for authentication.
  """
  
  @type t :: %__MODULE__{
    key: String.t(),
    name: String.t(),
    tier: :free | :basic | :pro | :enterprise,
    rate_limit: non_neg_integer(),
    daily_limit: non_neg_integer(),
    created_at: DateTime.t(),
    last_used_at: DateTime.t() | nil
  }
  
  defstruct [:key, :name, :tier, :rate_limit, :daily_limit, :created_at, :last_used_at]
  
  @spec generate_key() :: String.t()
  def generate_key do
    :crypto.strong_rand_bytes(32)
    |> Base.encode64()
    |> binary_part(0, 32)
  end
  
  @spec validate_key(String.t()) :: {:ok, t()} | {:error, :invalid | :expired}
  def validate_key(key) do
    case get_key(key) do
      nil -> {:error, :invalid}
      api_key -> {:ok, api_key}
    end
  end
  
  @spec check_rate_limit(t()) :: :ok | {:error, :rate_limited}
  def check_rate_limit(api_key) do
    current_usage = get_current_usage(api_key.key)
    
    if current_usage < api_key.rate_limit do
      :ok
    else
      {:error, :rate_limited}
    end
  end
end
```

### Rate Limiting

```elixir
defmodule Blunderfest.Auth.RateLimiter do
  @moduledoc """
  Rate limiting middleware.
  """
  
  use GenServer
  
  @type limit_config :: %{
    requests_per_minute: non_neg_integer(),
    requests_per_day: non_neg_integer()
  }
  
  @limits %{
    free: %{requests_per_minute: 60, requests_per_day: 1000},
    basic: %{requests_per_minute: 300, requests_per_day: 10000},
    pro: %{requests_per_minute: 1000, requests_per_day: 100000},
    enterprise: %{requests_per_minute: 5000, requests_per_day: :infinity}
  }
  
  defstruct [:buckets]
  
  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end
  
  @impl true
  def init(_opts) do
    state = %__MODULE__{
      buckets: :ets.new(:rate_limit_buckets, [:set, :public, 
        {:read_concurrency, true}, 
        {:write_concurrency, true}])
    }
    
    # Cleanup old entries every minute
    schedule_cleanup()
    
    {:ok, state}
  end
  
  @spec check_limit(String.t(), atom()) :: :ok | {:error, :rate_limited}
  def check_limit(api_key, tier) do
    limits = @limits[tier]
    bucket_key = "#{api_key}:#{div(System.system_time(:second), 60)}"
    
    current = :ets.update_counter(@buckets, bucket_key, {2, 1}, {bucket_key, 0})
    
    if current > limits.requests_per_minute do
      {:error, :rate_limited}
    else
      :ok
    end
  end
  
  defp schedule_cleanup() do
    Process.send_after(self(), :cleanup, 60000)
  end
end
```

### Input Validation

```elixir
defmodule Blunderfest.Security.InputValidator do
  @moduledoc """
  Input validation for security.
  """
  
  @max_pgn_size 10 * 1024 * 1024  # 10 MB
  @max_query_length 1000
  
  @spec validate_pgn(String.t()) :: :ok | {:error, String.t()}
  def validate_pgn(pgn) do
    cond do
      byte_size(pgn) > @max_pgn_size ->
        {:error, "PGN file too large (max #{@max_pgn_size} bytes)"}
        
      String.contains?(pgn, "\x00") ->
        {:error, "Invalid characters in PGN"}
        
      not valid_pgn_structure?(pgn) ->
        {:error, "Invalid PGN structure"}
        
      true ->
        :ok
    end
  end
  
  @spec validate_fen(String.t()) :: :ok | {:error, String.t()}
  def validate_fen(fen) do
    cond do
      String.length(fen) > 200 ->
        {:error, "FEN string too long"}
        
      not valid_fen_format?(fen) ->
        {:error, "Invalid FEN format"}
        
      true ->
        :ok
    end
  end
  
  @spec validate_query_params(map()) :: :ok | {:error, String.t()}
  def validate_query_params(params) do
    cond do
      map_size(params) > 20 ->
        {:error, "Too many query parameters"}
        
      Enum.any?(params, fn {_, v} -> String.length(to_string(v)) > @max_query_length end) ->
        {:error, "Query parameter value too long"}
        
      true ->
        :ok
    end
  end
  
  defp valid_pgn_structure?(pgn) do
    # Basic PGN structure validation
    String.contains?(pgn, "[") and String.contains?(pgn, "]")
  end
  
  defp valid_fen_format?(fen) do
    parts = String.split(fen, " ")
    length(parts) == 6
  end
end
```

## Testing Strategy

### Test Categories

1. **Unit Tests** - Individual functions and modules
2. **Integration Tests** - Module interactions
3. **Property Tests** - Property-based testing with StreamData
4. **Performance Tests** - Benchmarks and load testing
5. **Security Tests** - Security vulnerability testing

### Unit Test Structure

```elixir
defmodule Blunderfest.Chess.BoardTest do
  use ExUnit.Case, async: true
  
  describe "initial/0" do
    test "returns standard starting position" do
      board = Board.initial()
      
      assert board.side_to_move == :white
      assert map_size(board.pieces) == 32
      
      # Check specific pieces
      assert board.pieces[0] == {:white, :rook}   # a1
      assert board.pieces[4] == {:white, :king}   # e1
      assert board.pieces[56] == {:black, :rook}  # a8
    end
  end
  
  describe "apply_move/2" do
    setup do
      %{board: Board.initial()}
    end
    
    test "applies pawn move correctly", %{board: board} do
      move = %Move{from: 52, to: 36, piece: :pawn}  # e2-e4
      
      new_board = Board.apply_move(board, move)
      
      refute Map.has_key?(new_board.pieces, 52)
      assert new_board.pieces[36] == {:white, :pawn}
      assert new_board.side_to_move == :black
    end
    
    test "handles captures correctly", %{board: board} do
      # Setup: e4 e5
      board = board
      |> Board.apply_move(%Move{from: 52, to: 36, piece: :pawn})  # e2-e4
      |> Board.apply_move(%Move{from: 4, to: 20, piece: :pawn})   # e7-e5
      
      # Capture: d4xe5
      move = %Move{from: 36, to: 20, piece: :pawn, captured: :pawn}
      new_board = Board.apply_move(board, move)
      
      refute Map.has_key?(new_board.pieces, 36)
      assert new_board.pieces[20] == {:white, :pawn}
    end
  end
end
```

### Property-Based Testing

```elixir
defmodule Blunderfest.Chess.BoardProperties do
  use ExUnit.Case
  use PropCheck
  
  property "applying inverse moves returns to original position" do
    forall moves <- non_empty(list(move())) do
      board = Board.initial()
      
      final_board = Enum.reduce(moves, board, fn move, acc ->
        Board.apply_move(acc, move)
      end)
      
      # This property would need inverse move generation
      # For now, just check that the board is valid
      Board.valid?(final_board)
    end
  end
  
  property "position hash is consistent" do
    forall board <- board_generator() do
      hash1 = Zobrist.hash(board)
      hash2 = Zobrist.hash(board)
      
      hash1 == hash2
    end
  end
  
  defp board_generator do
    let moves <- list(move_generator()) do
      Enum.reduce(moves, Board.initial(), &Board.apply_move/2)
    end
  end
  
  defp move_generator do
    # Generate random legal moves
    # This is complex and would need proper implementation
  end
end
```

### Integration Tests

```elixir
defmodule Blunderfest.GameIntegrationTest do
  use ExUnit.Case, async: false
  
  setup do
    # Create temporary database
    db_path = Path.join(System.tmp_dir!(), "test_#{System.system_time()}.bchess")
    {:ok, db} = Blunderfest.Database.create(db_path)
    
    on_exit(fn ->
      Blunderfest.Database.close(db)
      File.rm!(db_path)
    end)
    
    %{db: db, db_path: db_path}
  end
  
  describe "game lifecycle" do
    test "create, add, retrieve, and delete game", %{db: db} do
      # Add game
      pgn = """
      [Event "Test"]
      [White "Player1"]
      [Black "Player2"]
      [Result "1-0"]
      
      1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0
      """
      
      {:ok, game_id} = Blunderfest.Game.add(db, pgn)
      assert is_integer(game_id)
      
      # Retrieve game
      {:ok, game} = Blunderfest.Game.get(db, game_id)
      assert game.tags["Event"] == "Test"
      assert game.tags["White"] == "Player1"
      assert length(game.moves) == 6
      
      # Delete game
      :ok = Blunderfest.Game.delete(db, game_id)
      assert {:error, :not_found} = Blunderfest.Game.get(db, game_id)
    end
  end
  
  describe "bulk import" do
    test "imports multiple games from PGN", %{db: db} do
      pgn = """
      [Event "Game1"]
      [White "A"]
      [Black "B"]
      [Result "1-0"]
      
      1. e4 e5 1-0
      
      [Event "Game2"]
      [White "C"]
      [Black "D"]
      [Result "0-1"]
      
      1. d4 d5 0-1
      """
      
      {:ok, count} = Blunderfest.Game.import_pgn(db, pgn)
      assert count == 2
      
      {:ok, games} = Blunderfest.Game.list(db)
      assert length(games) == 2
    end
  end
end
```

### Performance Benchmarks

```elixir
defmodule Blunderfest.Benchmarks do
  use Benchfella
  
  setup_all do
    {:ok, db} = Blunderfest.Database.create("bench_db.bchess")
    
    # Import sample games
    for _ <- 1..10000 do
      Blunderfest.Game.add(db, sample_pgn())
    end
    
    {:ok, db: db}
  end
  
  bench "position lookup" do
    fen = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3:0:0"
    Blunderfest.Position.stats(db, fen)
  end
  
  bench "game search" do
    Blunderfest.Search.games(db, white: "Player1", limit: 100)
  end
  
  bench "opening classification" do
    moves = ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"]
    Blunderfest.Analysis.classify_opening(db, moves)
  end
end
```

### Security Tests

```elixir
defmodule Blunderfest.SecurityTest do
  use ExUnit.Case, async: true
  
  describe "input validation" do
    test "rejects oversized PGN" do
      huge_pgn = String.duplicate("[Event \"Test\"]\n1. e4 e5 1-0\n", 1_000_000)
      
      assert {:error, "PGN file too large"} = 
        Blunderfest.Security.InputValidator.validate_pgn(huge_pgn)
    end
    
    test "rejects PGN with null bytes" do
      malicious_pgn = "[Event \"Test\x00\"]\n1. e4 e5 1-0"
      
      assert {:error, "Invalid characters in PGN"} = 
        Blunderfest.Security.InputValidator.validate_pgn(malicious_pgn)
    end
    
    test "rejects oversized query parameters" do
      huge_param = String.duplicate("a", 2000)
      
      assert {:error, "Query parameter value too long"} = 
        Blunderfest.Security.InputValidator.validate_query_params(%{search: huge_param})
    end
  end
  
  describe "rate limiting" do
    test "blocks requests after limit" do
      api_key = "test_key"
      
      # Make requests up to limit
      for _ <- 1..60 do
        assert :ok = Blunderfest.Auth.RateLimiter.check_limit(api_key, :free)
      end
      
      # Next request should be blocked
      assert {:error, :rate_limited} = 
        Blunderfest.Auth.RateLimiter.check_limit(api_key, :free)
    end
  end
end
```

### Continuous Integration

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Elixir
        uses: erlef/setup-beam@v1
        with:
          elixir-version: '1.17'
          otp-version: '27'
      
      - name: Restore dependencies cache
        uses: actions/cache@v3
        with:
          path: deps
          key: ${{ runner.os }}-mix-${{ hashFiles('**/mix.lock') }}
      
      - name: Install dependencies
        run: mix deps.get
      
      - name: Compile
        run: mix compile --warnings-as-errors
      
      - name: Run tests
        run: mix test --trace
      
      - name: Run benchmarks
        run: mix bench
      
      - name: Dialyzer
        run: mix dialyzer
      
      - name: Credo
        run: mix credo --strict
```

## Performance Targets

| Metric | Target | Test Method |
|--------|--------|-------------|
| Position lookup | < 1ms | Benchmark suite |
| Game search | < 100ms | Integration tests |
| PGN import | > 1000 games/sec | Load tests |
| Concurrent users | > 10,000 | Load tests |
| Memory usage | < 32GB | Monitoring |

## Monitoring

### Health Checks

```elixir
defmodule Blunderfest.Health do
  def check do
    %{
      status: "ok",
      version: Application.spec(:blunderfest, :vsn),
      uptime: :erlang.system_info(:uptime),
      database: check_database(),
      cache: check_cache()
    }
  end
end
```

### Metrics Collection

```elixir
:telemetry.attach(
  "blunderfest-metrics",
  [:blunderfest, :query, :stop],
  &Blunderfest.Metrics.handle_event/4,
  nil
)