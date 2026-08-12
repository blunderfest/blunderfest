defmodule Blunderfest.Engine.Pool do
  @moduledoc """
  A small supervised pool of Stockfish workers (ADR-0009). `eval/2` blocks
  until a worker answers; calls beyond the pool size wait in a FIFO queue
  (backpressure), and a crashed worker is replaced.

  The binary comes from the `:binary` option (tests use
  `test/support/fake_uci_engine.sh`), falling back to `stockfish` on PATH.
  """

  use GenServer

  alias Blunderfest.Engine.Worker

  @default_size 2

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: Keyword.get(opts, :name, __MODULE__))
  end

  @doc "Evaluates `fen` at `depth` on the next free worker; waits in line."
  def eval(fen, depth, pool \\ __MODULE__) do
    GenServer.call(pool, {:eval, fen, depth}, :infinity)
  end

  @impl true
  def init(opts) do
    size = Keyword.get(opts, :size, @default_size)

    binary =
      Keyword.get(opts, :binary) ||
        Application.get_env(:blunderfest, __MODULE__)[:binary] ||
        System.get_env("STOCKFISH_PATH") ||
        case :os.find_executable(~c"stockfish") do
          false ->
            # Missing binary: workers report :engine_unavailable, never crash.
            "stockfish"

          path ->
            List.to_string(path)
        end

    state = %{binary: binary, idle: [], busy: %{}, queue: :queue.new()}
    {:ok, state, {:continue, {:start_workers, size}}}
  end

  @impl true
  def handle_continue({:start_workers, size}, state) do
    workers = for _ <- 1..size, do: start_worker(state.binary)
    {:noreply, %{state | idle: workers}}
  end

  @impl true
  def handle_call({:eval, fen, depth}, from, state) do
    case state.idle do
      [worker | rest] ->
        {:noreply, dispatch(state, worker, rest, from, {fen, depth})}

      [] ->
        {:noreply, %{state | queue: :queue.in({from, {fen, depth}}, state.queue)}}
    end
  end

  @impl true
  def handle_info({:result, worker, from, result}, state) do
    GenServer.reply(from, result)
    state = %{state | busy: Map.delete(state.busy, worker)}

    case :queue.out(state.queue) do
      {{:value, {from2, {fen, depth}}}, queue} ->
        {:noreply, dispatch(%{state | queue: queue}, worker, [], from2, {fen, depth})}

      {:empty, queue} ->
        {:noreply, %{state | idle: [worker | state.idle], queue: queue}}
    end
  end

  def handle_info({:DOWN, _ref, :process, worker, _reason}, state) do
    # A crashed worker fails its caller and is replaced; queued work moves on.
    state = %{state | idle: List.delete(state.idle, worker)}

    case Map.pop(state.busy, worker) do
      {nil, busy} ->
        {:noreply, %{state | busy: busy, idle: [start_worker(state.binary) | state.idle]}}

      {from, busy} ->
        GenServer.reply(from, {:error, :engine_down})
        {:noreply, %{state | busy: busy, idle: [start_worker(state.binary) | state.idle]}}
    end
  end

  def handle_info({_port, {:data, _}}, state) do
    {:noreply, state}
  end

  defp dispatch(state, worker, idle_rest, from, {fen, depth}) do
    GenServer.cast(worker, {:run, self(), from, fen, depth})
    %{state | idle: idle_rest, busy: Map.put(state.busy, worker, from)}
  end

  defp start_worker(binary) do
    {:ok, pid} = Worker.start_link(binary: binary)
    Process.monitor(pid)
    pid
  end
end
