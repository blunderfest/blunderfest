defmodule Blunderfest.Engine.Worker do
  @moduledoc """
  One Stockfish binary process wrapped in a GenServer, speaking UCI over a
  Port (ADR-0009's batch layer). One evaluation at a time per worker — the
  call blocks until `bestmove`, so the caller's mailbox ordering is the
  queue.

  A missing binary or a dead engine never takes the caller down: `eval/3`
  returns `{:error, :engine_unavailable}`.
  """

  use GenServer

  @eval_timeout_ms 15_000

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts)
  end

  @doc "Evaluates `fen` at `depth`; returns `{:ok, result} | {:error, reason}`."
  def eval(worker, fen, depth) do
    GenServer.call(worker, {:eval, fen, depth}, @eval_timeout_ms + 5_000)
  catch
    :exit, _ -> {:error, :engine_unavailable}
  end

  @impl true
  def init(opts) do
    binary = Keyword.fetch!(opts, :binary)

    if File.exists?(binary) do
      {:ok, start_engine(binary), {:continue, :handshake}}
    else
      {:ok, %{port: nil, binary: binary}}
    end
  end

  @impl true
  def handle_continue(:handshake, %{port: port} = state) do
    Port.command(port, "uci\n")
    :ok = await(port, "uciok")
    Port.command(port, "isready\n")
    :ok = await(port, "readyok")
    {:noreply, state}
  end

  @impl true
  def handle_call({:eval, _fen, _depth}, _from, %{port: nil} = state) do
    {:reply, {:error, :engine_unavailable}, state}
  end

  def handle_call({:eval, fen, depth}, _from, state) do
    {:reply, run_eval(state.port, fen, depth), state}
  end

  # The pool dispatches work as a cast; the result goes back by plain message.
  @impl true
  def handle_cast({:run, pool, from, _fen, _depth}, %{port: nil} = state) do
    send(pool, {:result, self(), from, {:error, :engine_unavailable}})
    {:noreply, state}
  end

  def handle_cast({:run, pool, from, fen, depth}, state) do
    send(pool, {:result, self(), from, run_eval(state.port, fen, depth)})
    {:noreply, state}
  end

  defp run_eval(port, fen, depth) do
    Port.command(port, "position fen #{fen}\n")
    Port.command(port, "go depth #{depth}\n")
    collect(port, nil)
  end

  @impl true
  def handle_info({port, {:exit_status, _status}}, %{port: port} = state) do
    {:noreply, restart_engine(state)}
  end

  def handle_info({:EXIT, port, _reason}, %{port: port} = state) do
    {:noreply, restart_engine(state)}
  end

  def handle_info({_port, {:data, _}}, state) do
    # Stray output between jobs (a late line after a timeout) — discard.
    {:noreply, state}
  end

  defp start_engine(binary) do
    %{
      port:
        Port.open({:spawn_executable, binary}, [:binary, :stream, {:line, 4096}, :exit_status]),
      binary: binary
    }
  end

  # Restart the engine process and redo the UCI handshake.
  defp restart_engine(%{port: port, binary: binary}) do
    Port.close(port)
    state = start_engine(binary)

    Port.command(state.port, "uci\n")
    :ok = await(state.port, "uciok")
    Port.command(state.port, "isready\n")
    :ok = await(state.port, "readyok")

    state
  end

  defp await(port, expected) do
    receive do
      {^port, {:data, {:eol, line}}} ->
        if String.trim(line) == expected, do: :ok, else: await(port, expected)

      {^port, {:exit_status, status}} ->
        {:error, {:engine_exited, status}}
    after
      10_000 -> {:error, :handshake_timeout}
    end
  end

  # Read info lines until bestmove; keep the deepest-scored info.
  defp collect(port, best) do
    receive do
      {^port, {:data, {:eol, line}}} ->
        line = String.trim(line)

        if String.starts_with?(line, "bestmove") do
          finalize(line, best)
        else
          collect(port, deeper(line, best))
        end

      {^port, {:exit_status, _status}} ->
        {:error, :engine_exited}
    after
      @eval_timeout_ms -> {:error, :timeout}
    end
  end

  defp deeper(line, best) do
    case parse_info(line) do
      nil -> best
      info -> if best == nil or info.depth >= best.depth, do: info, else: best
    end
  end

  defp finalize(line, best) do
    best_move = String.split(line) |> Enum.at(1)

    if best == nil do
      {:error, :no_score}
    else
      {:ok, %{score: best.score, depth: best.depth, best_move: best_move}}
    end
  end

  # info depth 12 seldepth 18 multipv 1 score cp 30 nodes … pv e2e4 …
  defp parse_info(line) do
    with ["info" | tokens] <- String.split(line),
         {:ok, depth} <- fetch_int(tokens, "depth"),
         {:ok, score} <- fetch_score(tokens) do
      %{depth: depth, score: score}
    else
      _ -> nil
    end
  end

  defp fetch_int(tokens, key) do
    case Enum.find_index(tokens, &(&1 == key)) do
      nil ->
        :error

      i ->
        case Integer.parse(Enum.at(tokens, i + 1, "")) do
          {n, ""} -> {:ok, n}
          _ -> :error
        end
    end
  end

  defp fetch_score(tokens) do
    case Enum.find_index(tokens, &(&1 == "score")) do
      nil ->
        :error

      i ->
        case Enum.slice(tokens, i + 1, 2) do
          ["cp", n] ->
            with {n, ""} <- Integer.parse(n), do: {:ok, %{"cp" => n}}

          ["mate", n] ->
            with {n, ""} <- Integer.parse(n), do: {:ok, %{"mate" => n}}

          _ ->
            :error
        end
    end
  end
end
