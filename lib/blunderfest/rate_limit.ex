defmodule Blunderfest.RateLimit do
  @moduledoc """
  Fixed-window rate limiter for the expensive anonymous endpoints — today
  that's just room creation.

  Per-client-IP, per-node: on the two-node cluster each node allows its own
  share of the traffic, which is all abuse mitigation needs. State is
  in-memory and resets on boot like everything else (ADR-0001); expired
  windows are pruned periodically so the map can't grow without bound.
  """

  use GenServer

  @default_limit 10
  @default_window_ms :timer.minutes(1)
  @prune_interval_ms :timer.minutes(5)

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: Keyword.get(opts, :name, __MODULE__))
  end

  @doc "Registers a hit for `key`: `:allow` under the limit, `:deny` at or beyond it."
  def hit(key, server \\ __MODULE__) do
    GenServer.call(server, {:hit, key, now()})
  end

  @doc "Like `hit/2`, but at an explicit monotonic timestamp (test seam)."
  def hit_at(key, now_ms, server) do
    GenServer.call(server, {:hit, key, now_ms})
  end

  @doc "Drops all windows (test seam)."
  def reset(server \\ __MODULE__) do
    GenServer.call(server, :reset)
  end

  @impl true
  def init(opts) do
    schedule_prune()

    {:ok,
     %{
       limit: Keyword.get(opts, :limit, @default_limit),
       window_ms: Keyword.get(opts, :window_ms, @default_window_ms),
       hits: %{}
     }}
  end

  @impl true
  def handle_call({:hit, key, now_ms}, _from, state) do
    case state.hits[key] do
      {window_start, count} when now_ms - window_start < state.window_ms ->
        if count >= state.limit do
          {:reply, :deny, state}
        else
          {:reply, :allow, put_in(state, [:hits, key], {window_start, count + 1})}
        end

      _ ->
        {:reply, :allow, put_in(state, [:hits, key], {now_ms, 1})}
    end
  end

  def handle_call(:reset, _from, state) do
    {:reply, :ok, %{state | hits: %{}}}
  end

  @impl true
  def handle_info(:prune, state) do
    cutoff = now() - state.window_ms

    hits =
      Map.filter(state.hits, fn {_key, {window_start, _count}} -> window_start >= cutoff end)

    schedule_prune()
    {:noreply, %{state | hits: hits}}
  end

  defp schedule_prune do
    Process.send_after(self(), :prune, @prune_interval_ms)
  end

  defp now, do: System.monotonic_time(:millisecond)
end
