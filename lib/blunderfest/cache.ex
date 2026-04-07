defmodule Blunderfest.Cache do
  @moduledoc """
  LRU cache for hot data using ETS.
  """

  use GenServer

  @type entry :: %{data: term(), accessed: non_neg_integer()}

  defstruct [:table, :max_size, :max_memory, :current_memory]

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(opts) do
    table =
      :ets.new(__MODULE__, [
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
      [{^key, data, accessed}] ->
        :ets.insert(__MODULE__, {key, data, System.system_time(:millisecond)})
        data

      [] ->
        nil
    end
  end

  @spec put(any(), term(), non_neg_integer()) :: :ok
  def put(key, data, size_bytes \\ 0) do
    GenServer.cast(__MODULE__, {:put, key, data, size_bytes})
  end

  @spec hit_rate() :: float()
  def hit_rate do
    :ets.lookup_element(__MODULE__, :stats, 2)
  end

  @impl true
  def handle_cast({:put, key, data, size_bytes}, state) do
    state = maybe_evict(state, size_bytes)

    :ets.insert(state.table, {key, data, System.system_time(:millisecond)})

    {:noreply, %{state | current_memory: state.current_memory + size_bytes}}
  end

  defp maybe_evict(state, needed_bytes) do
    if state.current_memory + needed_bytes > state.max_memory do
      evict_lru(state, needed_bytes)
    else
      state
    end
  end

  defp evict_lru(state, _needed_bytes) do
    entries = :ets.tab2list(state.table) |> Enum.reject(fn {k, _, _} -> k == :stats end)
    sorted = Enum.sort_by(entries, fn {_, _, accessed} -> accessed end)

    {evicted, remaining} =
      Enum.split_while(sorted, fn {_, _, _} ->
        state.current_memory > state.max_memory / 2
      end)

    Enum.each(evicted, fn {key, _, _} -> :ets.delete(__MODULE__, key) end)

    new_memory = Enum.reduce(remaining, 0, fn {_, _, _}, acc -> acc + 100 end)
    %{state | current_memory: max(0, new_memory)}
  end

  defp schedule_cleanup do
    Process.send_after(self(), :cleanup, 60_000)
  end

  @impl true
  def handle_info(:cleanup, state) do
    now = System.system_time(:millisecond)

    :ets.tab2list(state.table)
    |> Enum.reject(fn {k, _, _} -> k == :stats end)
    |> Enum.each(fn {key, _, accessed} ->
      if now - accessed > 1_800_000 do
        :ets.delete(__MODULE__, key)
      end
    end)

    schedule_cleanup()
    {:noreply, state}
  end
end
