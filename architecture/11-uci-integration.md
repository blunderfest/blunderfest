# UCI Engine Integration Specification

## Overview

The Universal Chess Interface (UCI) protocol allows integration with chess engines for position analysis. This document specifies how Blunderfest integrates with UCI engines.

## Design Choices

### Engine Integration Approach

**Choice: External Process vs. Native Engine**

We'll use **external process communication** with existing engines (Stockfish, Leela) rather than building a native engine.

**Rationale**:
- World-class engine strength immediately available (3500+ ELO)
- No development time for engine creation
- Support for multiple engines
- Engine updates independent of database

### Process Management

**Choice: Persistent vs. On-Demand Engine Processes**

We'll use **persistent engine pools** with on-demand scaling.

**Rationale**:
- Faster analysis start (no process startup delay)
- Resource efficiency (share engines across requests)
- Better control over resource usage

## UCI Protocol Implementation

### UCI Communication

```elixir
defmodule Blunderfest.Analysis.UCI do
  @moduledoc """
  UCI protocol implementation for chess engine communication.
  """
  
  use GenServer
  
  @type option :: %{
    name: String.t(),
    type: :check | :spin | :combo | :button | :string | :filename,
    default: any(),
    min: integer() | nil,
    max: integer() | nil,
    vars: [String.t()] | nil
  }
  
  defstruct [
    :port,
    :engine_path,
    :options,
    :state,
    :analysis_callback,
    :current_analysis
  ]
  
  @type state :: %__MODULE__{
    port: port() | nil,
    engine_path: String.t(),
    options: %{String.t() => option()},
    state: :starting | :ready | :analyzing | :stopped,
    analysis_callback: function() | nil,
    current_analysis: map() | nil
  }
  
  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end
  
  @impl true
  def init(opts) do
    engine_path = Keyword.get(opts, :engine_path, "stockfish")
    
    state = %__MODULE__{
      engine_path: engine_path,
      options: %{},
      state: :starting,
      analysis_callback: nil,
      current_analysis: nil
    }
    
    # Start engine process
    {:ok, port} = start_engine(engine_path)
    
    # Send UCI command
    send_command(port, "uci")
    
    {:ok, %{state | port: port}}
  end
  
  defp start_engine(path) do
    Port.open({:spawn_executable, path}, [
      :binary,
      :exit_status,
      :stderr_to_stdout,
      {:line, 1024}
    ])
  end
  
  defp send_command(port, command) do
    Port.command(port, command <> "\n")
  end
  
  # Handle engine output
  def handle_info({port, {:data, {:eol, line}}}, %{port: port} = state) do
    line = String.trim(line)
    
    case parse_engine_output(line, state) do
      {:ok, new_state} -> {:noreply, new_state}
      {:reply, reply, new_state} -> {:reply, reply, new_state}
      :unknown -> {:noreply, state}
    end
  end
  
  defp parse_engine_output("id name " <> name, state) do
    {:ok, %{state | options: Map.put(state.options, :engine_name, name)}}
  end
  
  defp parse_engine_output("id author " <> author, state) do
    {:ok, %{state | options: Map.put(state.options, :engine_author, author)}}
  end
  
  defp parse_engine_output("option " <> rest, state) do
    option = parse_option(rest)
    {:ok, %{state | options: Map.put(state.options, option.name, option)}}
  end
  
  defp parse_engine_output("uciok", state) do
    # Engine ready, send isready
    send_command(state.port, "isready")
    {:ok, state}
  end
  
  defp parse_engine_output("readyok", state) do
    # Engine ready for analysis
    {:reply, :ready, %{state | state: :ready}}
  end
  
  defp parse_engine_output("info " <> rest, state) do
    info = parse_info(rest)
    
    if state.analysis_callback do
      state.analysis_callback.({:info, info})
    end
    
    {:ok, state}
  end
  
  defp parse_engine_output("bestmove " <> rest, state) do
    bestmove = parse_bestmove(rest)
    
    if state.analysis_callback do
      state.analysis_callback.({:bestmove, bestmove})
    end
    
    {:ok, %{state | state: :ready, current_analysis: nil}}
  end
  
  defp parse_engine_output("copyprotection " <> status, state) do
    if status == "ok" do
      send_command(state.port, "isready")
    end
    
    {:ok, state}
  end
  
  defp parse_engine_output(_, _state) do
    :unknown
  end
  
  # UCI Commands
  
  @spec set_option(String.t(), any()) :: :ok
  def set_option(name, value) do
    GenServer.call(__MODULE__, {:set_option, name, value})
  end
  
  @impl true
  def handle_call({:set_option, name, value}, _from, state) do
    send_command(state.port, "setoption name #{name} value #{value}")
    {:reply, :ok, state}
  end
  
  @spec position(FEN.t(), [Move.t()]) :: :ok
  def position(fen, moves \\ []) do
    GenServer.cast(__MODULE__, {:position, fen, moves})
  end
  
  @impl true
  def handle_cast({:position, fen, moves}, state) do
    if Enum.empty?(moves) do
      send_command(state.port, "position fen #{fen}")
    else
      moves_san = Enum.map(moves, &Move.to_san/1)
      send_command(state.port, "position fen #{fen} moves #{Enum.join(moves_san, " ")}")
    end
    
    {:noreply, state}
  end
  
  @spec go(keyword()) :: :ok
  def go(opts \\ []) do
    GenServer.cast(__MODULE__, {:go, opts})
  end
  
  @impl true
  def handle_cast({:go, opts}, state) do
    cmd = build_go_command(opts)
    send_command(state.port, cmd)
    
    {:noreply, %{state | state: :analyzing}}
  end
  
  defp build_go_command(opts) do
    parts = ["go"]
    
    parts = if depth = opts[:depth] do
      parts ++ ["depth #{depth}"]
    else
      parts
    end
    
    parts = if time = opts[:time] do
      parts ++ ["wtime #{time[:white]} btime #{time[:black]}"]
    else
      parts
    end
    
    parts = if nodes = opts[:nodes] do
      parts ++ ["nodes #{nodes}"]
    else
      parts
    end
    
    Enum.join(parts, " ")
  end
  
  @spec stop() :: :ok
  def stop() do
    GenServer.cast(__MODULE__, :stop)
  end
  
  @impl true
  def handle_cast(:stop, state) do
    send_command(state.port, "stop")
    {:noreply, state}
  end
  
  @spec quit() :: :ok
  def quit() do
    GenServer.cast(__MODULE__, :quit)
  end
  
  @impl true
  def handle_cast(:quit, state) do
    send_command(state.port, "quit")
    {:stop, :normal, state}
  end
  
  # Helper functions
  
  defp parse_option(rest) do
    # Parse "name <name> type <type> default <default> min <min> max <max> var <var>"
    parts = String.split(rest, " ")
    
    %{
      name: extract_value(parts, "name"),
      type: String.to_atom(extract_value(parts, "type")),
      default: extract_value(parts, "default"),
      min: extract_value(parts, "min") |> Integer.parse() |> elem(0),
      max: extract_value(parts, "max") |> Integer.parse() |> elem(0),
      vars: extract_vars(parts)
    }
  end
  
  defp extract_value(parts, key) do
    case Enum.find_index(parts, &(&1 == key)) do
      nil -> nil
      idx -> Enum.at(parts, idx + 1)
    end
  end
  
  defp extract_vars(parts) do
    case Enum.find_index(parts, &(&1 == "var")) do
      nil -> nil
      idx -> Enum.drop(parts, idx + 1)
    end
  end
  
  defp parse_info(rest) do
    # Parse "depth <d> seldepth <s> time <t> nodes <n> pv <pv> ..."
    parts = String.split(rest, " ")
    
    %{
      depth: extract_int(parts, "depth"),
      seldepth: extract_int(parts, "seldepth"),
      time: extract_int(parts, "time"),
      nodes: extract_int(parts, "nodes"),
      score: parse_score(parts),
      pv: extract_pv(parts),
      nps: extract_int(parts, "nps"),
      tbhits: extract_int(parts, "tbhits")
    }
  end
  
  defp extract_int(parts, key) do
    case extract_value(parts, key) do
      nil -> nil
      val -> String.to_integer(val)
    end
  end
  
  defp parse_score(parts) do
    case Enum.find_index(parts, &(&1 == "score")) do
      nil -> nil
      idx ->
        cp_idx = idx + 2  # score cp/mate <value>
        value = Enum.at(parts, cp_idx)
        
        cond do
          Enum.at(parts, idx + 1) == "mate" ->
            {:mate, String.to_integer(value)}
          Enum.at(parts, idx + 1) == "cp" ->
            {:cp, String.to_integer(value) / 100}
          true -> nil
        end
    end
  end
  
  defp extract_pv(parts) do
    case Enum.find_index(parts, &(&1 == "pv")) do
      nil -> []
      idx -> Enum.drop(parts, idx + 1)
    end
  end
  
  defp parse_bestmove(rest) do
    [bestmove | rest_parts] = String.split(rest, " ")
    
    ponder = case Enum.find(rest_parts, &(&1 == "ponder")) do
      nil -> nil
      _ -> Enum.at(rest_parts, 1)
    end
    
    %{
      bestmove: bestmove,
      ponder: ponder
    }
  end
end
```

### Engine Pool

```elixir
defmodule Blunderfest.Analysis.EnginePool do
  @moduledoc """
  Pool of UCI engine processes for concurrent analysis.
  """
  
  use DynamicSupervisor
  
  @type engine_spec :: %{
    name: String.t(),
    path: String.t(),
    options: keyword()
  }
  
  defstruct [:engines, :queue]
  
  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts) do
    DynamicSupervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end
  
  @impl true
  def init(opts) do
    engines = Keyword.get(opts, :engines, [])
    max_engines = Keyword.get(opts, :max_engines, 10)
    
    DynamicSupervisor.init(
      strategy: :one_for_one,
      max_restarts: max_engines,
      max_seconds: 60
    )
  end
  
  @spec add_engine(engine_spec()) :: {:ok, pid()} | {:error, term()}
  def add_engine(%{name: name, path: path, options: options}) do
    spec = {Blunderfest.Analysis.UCI, [engine_path: path, options: options]}
    DynamicSupervisor.start_child(__MODULE__, spec)
  end
  
  @spec request_analysis(FEN.t(), keyword()) :: {:ok, reference()} | {:error, term()}
  def request_analysis(fen, opts \\ []) do
    # Get available engine
    case get_available_engine() do
      {:ok, engine_pid} ->
        ref = make_ref()
        GenServer.cast(engine_pid, {:analyze, fen, opts, ref, self()})
        {:ok, ref}
        
      :error ->
        # Queue the request
        queue_analysis(fen, opts)
    end
  end
  
  defp get_available_engine do
    # Find an engine that's not currently analyzing
    children = DynamicSupervisor.which_children(__MODULE__)
    
    available = Enum.find(children, fn {_id, pid, _type, _modules} ->
      GenServer.call(pid, :available?)
    end)
    
    case available do
      {_, pid, _, _} -> {:ok, pid}
      nil -> :error
    end
  end
  
  defp queue_analysis(fen, opts) do
    # Add to queue, will be processed when engine available
    GenServer.cast(__MODULE__, {:queue, fen, opts, self()})
  end
end
```

### Analysis Results Caching

```elixir
defmodule Blunderfest.Analysis.Cache do
  @moduledoc """
  Cache for engine analysis results.
  """
  
  use GenServer
  
  defstruct [:cache, :max_size, :ttl]
  
  @type cache_entry :: %{
    score: {atom(), float()},
    depth: integer(),
    pv: [String.t()],
    timestamp: integer()
  }
  
  @default_ttl 86400000  # 24 hours
  
  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts)
  end
  
  @impl true
  def init(opts) do
    state = %__MODULE__{
      cache: :ets.new(:analysis_cache, [:set, :public, 
        {:read_concurrency, true}, 
        {:write_concurrency, true}]),
      max_size: Keyword.get(opts, :max_size, 1_000_000),
      ttl: Keyword.get(opts, :ttl, @default_ttl)
    }
    
    # Start cleanup timer
    schedule_cleanup()
    
    {:ok, state}
  end
  
  @spec get(FEN.t(), integer()) :: cache_entry() | nil
  def get(fen, min_depth \\ 20) do
    hash = :crypto.hash(:sha256, fen)
    
    case :ets.lookup(@cache, hash) do
      [{^hash, entry}] ->
        if entry.depth >= min_depth and not expired?(entry) do
          entry
        else
          nil
        end
        
      [] ->
        nil
    end
  end
  
  @spec put(FEN.t(), cache_entry()) :: :ok
  def put(fen, entry) do
    hash = :crypto.hash(:sha256, fen)
    entry = Map.put(entry, :timestamp, System.system_time(:millisecond))
    
    :ets.insert(@cache, {hash, entry})
    
    # Check size and cleanup if needed
    if :ets.info(@cache)[:size] > @max_size do
      cleanup()
    end
    
    :ok
  end
  
  defp expired?(entry) do
    age = System.system_time(:millisecond) - entry.timestamp
    age > @ttl
  end
  
  defp schedule_cleanup() do
    Process.send_after(self(), :cleanup, 3600000)  # Every hour
  end
  
  defp cleanup() do
    now = System.system_time(:millisecond)
    
    :ets.select_delete(@cache, [
      {{:"$1", :"$2"}, [], [{:<, :"+", :"$2.timestamp", now - @ttl}]}
    ])
    
    schedule_cleanup()
  end
end
```

## Supported Engines

### Stockfish

```elixir
# Stockfish configuration
config :blunderfest, :engines,
  stockfish: %{
    name: "Stockfish",
    path: "/usr/games/stockfish",
    options: [
      Threads: 4,
      Hash: 1024,
      Use NNUE: true
    ]
  }
```

### Leela Chess Zero

```elixir
# Lc0 configuration
config :blunderfest, :engines,
  lc0: %{
    name: "Lc0",
    path: "/usr/games/lc0",
    options: [
      Threads: 4,
      NNUEFile: "/path/to/network.pb.gz"
    ]
  }
```

## Analysis API

### Synchronous Analysis

```elixir
@spec analyze_position(FEN.t(), keyword()) :: analysis_result()
def analyze_position(fen, opts \\ []) do
  depth = Keyword.get(opts, :depth, 20)
  time_limit = Keyword.get(opts, :time_limit, 5000)
  engine = Keyword.get(opts, :engine, :stockfish)
  
  # Check cache first
  case Cache.get(fen, depth) do
    nil -> :ok
    cached -> return_cached_result(cached)
  end
  
  # Request analysis
  with {:ok, ref} <- EnginePool.request_analysis(fen, 
         depth: depth, 
         time: time_limit,
         engine: engine) do
    receive do
      {^ref, :info, info} ->
        # Intermediate info, continue waiting
        analyze_position(fen, opts)
        
      {^ref, :bestmove, result} ->
        # Cache and return
        Cache.put(fen, result)
        {:ok, result}
        
    after
      time_limit + 1000 ->
        {:error, :timeout}
    end
  end
end
```

### Asynchronous Analysis

```elixir
@spec analyze_async(FEN.t(), keyword(), function()) :: :ok
def analyze_async(fen, opts \\ [], callback) do
  EnginePool.request_analysis(fen, Keyword.put(opts, :callback, callback))
end
```

## Performance Considerations

### Engine Resource Management

1. **Thread limits**: Set based on available CPU cores
2. **Hash size**: Allocate based on available memory
3. **Concurrent engines**: Limit based on system resources
4. **Analysis priority**: Queue system for high-demand periods

### Caching Strategy

1. **Hot positions**: Cache frequently analyzed positions
2. **TTL**: 24-hour default, configurable per position type
3. **Size limits**: LRU eviction when cache full
4. **Depth thresholds**: Only cache analyses above minimum depth

## Testing

### Engine Integration Tests

```elixir
defmodule Blunderfest.Analysis.UCITest do
  use ExUnit.Case
  
  setup do
    {:ok, pid} = start_supervised({Blunderfest.Analysis.UCI, 
      engine_path: "stockfish"})
    %{engine: pid}
  end
  
  test "engine starts and responds to uci", %{engine: engine} do
    assert GenServer.call(engine, :available?) == true
  end
  
  test "analyzes position", %{engine: engine} do
    fen = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 3:0:0"
    
    result = Blunderfest.Analysis.analyze_position(fen, depth: 15)
    
    assert {:ok, %{bestmove: bestmove}} = result
    assert is_binary(bestmove)
  end
end