defmodule Blunderfest.Storage.PositionIndex do
  @moduledoc """
  In-memory position index using ETS for fast lookups.
  """

  use GenServer

  @type entry :: %{
    hash: non_neg_integer(),
    game_ids: [non_neg_integer()],
    stats: %{
      white_wins: non_neg_integer(),
      black_wins: non_neg_integer(),
      draws: non_neg_integer()
    }
  }

  @type t :: %__MODULE__{table: atom()}

  defstruct [:table]

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def init(_opts) do
    table = :ets.new(:position_index, [
      :set,
      :public,
      :named_table,
      {:read_concurrency, true},
      {:write_concurrency, true}
    ])

    {:ok, %__MODULE__{table: table}}
  end

  @spec insert(t(), non_neg_integer(), non_neg_integer(), map()) :: :ok
  def insert(%__MODULE__{} = index, hash, game_id, stats) do
    GenServer.cast(__MODULE__, {:insert, index.table, hash, game_id, stats})
  end

  @spec lookup(t() | atom(), non_neg_integer()) :: {:ok, entry()} | :error
  def lookup(table_or_name, hash) when is_atom(table_or_name) do
    case :ets.lookup(table_or_name, hash) do
      [{^hash, game_ids, stats}] ->
        {:ok, %{hash: hash, game_ids: game_ids, stats: stats}}

      [] ->
        :error
    end
  end

  def lookup(%__MODULE__{} = index, hash) do
    lookup(index.table, hash)
  end

  @impl true
  def handle_cast({:insert, table, hash, game_id, stats}, state) do
    case :ets.lookup(table, hash) do
      [{^hash, existing_game_ids, existing_stats}] ->
        :ets.insert(table, {hash, [game_id | existing_game_ids], merge_stats(existing_stats, stats)})

      [] ->
        :ets.insert(table, {hash, [game_id], stats})
    end

    {:noreply, state}
  end

  defp merge_stats(s1, s2) do
    %{
      white_wins: s1.white_wins + s2.white_wins,
      black_wins: s1.black_wins + s2.black_wins,
      draws: s1.draws + s2.draws
    }
  end
end
