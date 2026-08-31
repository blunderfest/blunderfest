defmodule Blunderfest.Corpus do
  @moduledoc """
  The `Blunderfest.Corpus` boundary facade (ADR-0026): the one place
  application code touches the corpus.

  Owns the Postgrex pool for the occurrence store and delegates every query
  through a single process, so the physical representation (Postgres today,
  the packed binary index later) stays replaceable behind this surface —
  application code never sees a table, a key encoding, or a connection.

  When no `db:` configuration exists (dev without `DATABASE_URL`, per
  ADR-0026), the process starts in an unconfigured state: every query
  returns `{:error, :not_configured}` instead of crashing the app.
  """

  use GenServer

  alias Blunderfest.Corpus.{Book, GameExport, Occurrences, PositionKey}

  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  ## Application-facing query API

  @doc "Whether a corpus database is configured (ADR-0026 graceful absence)."
  @spec configured?() :: boolean()
  def configured?, do: GenServer.call(__MODULE__, :configured?)

  @doc "Every occurrence of a canonical key as `[{gid, ply}]`, in game/ply order."
  @spec occurrences(String.t()) :: [{pos_integer(), pos_integer()}] | {:error, :not_configured}
  def occurrences(key), do: GenServer.call(__MODULE__, {:occurrences, key}, :infinity)

  @doc "Total occurrence and independent-game counts for a canonical key, one query."
  @spec occurrence_counts(String.t()) :: map() | {:error, :not_configured}
  def occurrence_counts(key), do: GenServer.call(__MODULE__, {:occurrence_counts, key}, :infinity)

  @doc "The position row for a canonical key, or nil if never seen."
  @spec position(String.t()) :: map() | nil | {:error, :not_configured}
  def position(key), do: GenServer.call(__MODULE__, {:position, key}, :infinity)

  @doc "Distinct canonical keys sharing a pawn-skeleton hash."
  @spec pawn_bucket(non_neg_integer()) :: [String.t()] | {:error, :not_configured}
  def pawn_bucket(pawn_hash), do: GenServer.call(__MODULE__, {:pawn_bucket, pawn_hash}, :infinity)

  @doc "Game metadata for a gid, or nil."
  @spec game(pos_integer()) :: map() | nil | {:error, :not_configured}
  def game(gid), do: GenServer.call(__MODULE__, {:game, gid}, :infinity)

  @doc "Mainline SAN list of a game (empty when unknown)."
  @spec moves(pos_integer()) :: [String.t()] | {:error, :not_configured}
  def moves(gid), do: GenServer.call(__MODULE__, {:moves, gid}, :infinity)

  @doc "Mainline SAN lists for a batch of gids, one query — `%{gid => sans_list}`."
  @spec moves_for([pos_integer()]) :: %{pos_integer() => [String.t()]} | {:error, :not_configured}
  def moves_for(gids), do: GenServer.call(__MODULE__, {:moves_for, gids}, :infinity)

  @doc """
  The opening-book next-move stats for a FEN (games + W/D/B per move),
  `[]` for a position with no occurrences.
  """
  @spec book(String.t()) :: [Book.row()] | {:error, :not_configured | :invalid_fen}
  def book(fen), do: GenServer.call(__MODULE__, {:book, fen}, :infinity)

  @doc """
  Independent-game counts for a batch of FENs, one query (the
  transposition candidates' support). Invalid FENs are skipped.
  `%{fen => games}` — positions with no occurrences are absent.
  """
  @spec book_counts([String.t()]) ::
          %{String.t() => non_neg_integer()} | {:error, :not_configured}
  def book_counts(fens), do: GenServer.call(__MODULE__, {:book_counts, fens}, :infinity)

  @doc "Row counts of the four corpus tables."
  @spec counts() :: map() | {:error, :not_configured}
  def counts, do: GenServer.call(__MODULE__, :counts, :infinity)

  @doc """
  Drops and rebuilds the corpus tables from the extraction artifacts.
  Idempotent; the rebuild path ADR-0026 keeps available.
  """
  @spec rebuild(Path.t(), non_neg_integer()) :: map() | {:error, :not_configured}
  def rebuild(data_dir, tier) do
    GenServer.call(__MODULE__, {:rebuild, data_dir, tier}, :infinity)
  end

  @doc """
  Loads from prepared positions rows (`corpus.prepare`), games and moves —
  the production load path (pure COPY, no transform on the machine).
  """
  @spec load_prepared(Path.t(), Path.t(), Path.t()) :: map() | {:error, :not_configured}
  def load_prepared(positions_path, games_path, moves_path) do
    GenServer.call(
      __MODULE__,
      {:load_prepared, positions_path, games_path, moves_path},
      :infinity
    )
  end

  @doc """
  A corpus game as a playable game tree (mainline only — the corpus drops
  clocks, comments and variations by design).
  """
  @spec export_game(pos_integer()) ::
          {:ok, Blunderfest.Game.Tree.t()}
          | {:error, :not_found | :parse_failed | :not_configured}
  def export_game(gid) do
    GenServer.call(__MODULE__, {:export_game, gid}, :infinity)
  end

  ## Callbacks

  @impl true
  def init(_opts) do
    db = Application.get_env(:blunderfest, __MODULE__)[:db]

    pool =
      if db do
        # Generous deadlines: corpus queries are batch operations (COPY
        # loads, index builds) that legitimately run minutes, and the
        # facade serializes them anyway — no checkout contention to bound.
        {:ok, pool} =
          Postgrex.start_link(Keyword.merge([pool_size: 4, timeout: :infinity, n: 1_800_000], db))

        pool
      else
        nil
      end

    {:ok, %{pool: pool}}
  end

  @impl true
  def handle_call(:configured?, _from, state) do
    {:reply, state.pool != nil, state}
  end

  def handle_call({fun, _arg}, _from, %{pool: nil} = state)
      when fun in [
             :occurrences,
             :position,
             :pawn_bucket,
             :game,
             :moves,
             :moves_for,
             :book,
             :book_counts,
             :occurrence_counts
           ] do
    {:reply, {:error, :not_configured}, state}
  end

  def handle_call({:book, fen}, _from, state) do
    {:reply, Book.for_fen(state.pool, fen), state}
  end

  def handle_call({:book_counts, fens}, _from, state) do
    # Canonicalize each FEN to a key (invalid FENs skipped), batch into one
    # query, and map counts back to the caller's FENs.
    fen_keys =
      fens
      |> Enum.uniq()
      |> Enum.flat_map(fn fen ->
        case PositionKey.from_fen(fen) do
          {:ok, key} -> [{fen, key}]
          {:error, _} -> []
        end
      end)

    counts = Book.counts_for_keys(state.pool, Enum.map(fen_keys, fn {_fen, key} -> key end))

    # A key can serve several FENs (FEN move-counter differences); map back,
    # dropping positions with no occurrences.
    result =
      for {fen, key} <- fen_keys,
          count = Map.get(counts, key),
          count !== nil,
          into: %{} do
        {fen, count}
      end

    {:reply, result, state}
  end

  def handle_call({:occurrences, key}, _from, state) do
    {:reply, Occurrences.occurrences(state.pool, key), state}
  end

  def handle_call({:occurrence_counts, key}, _from, state) do
    {:reply, Occurrences.counts_for(state.pool, key), state}
  end

  def handle_call({:position, key}, _from, state) do
    {:reply, Occurrences.position(state.pool, key), state}
  end

  def handle_call({:pawn_bucket, pawn_hash}, _from, state) do
    {:reply, Occurrences.pawn_bucket(state.pool, pawn_hash), state}
  end

  def handle_call({:game, gid}, _from, state) do
    {:reply, Occurrences.game(state.pool, gid), state}
  end

  def handle_call({:moves, gid}, _from, state) do
    {:reply, Occurrences.moves(state.pool, gid), state}
  end

  def handle_call({:moves_for, gids}, _from, state) do
    {:reply, Occurrences.moves_for(state.pool, gids), state}
  end

  def handle_call(:counts, _from, %{pool: nil} = state) do
    {:reply, {:error, :not_configured}, state}
  end

  def handle_call(:counts, _from, state) do
    {:reply, Occurrences.counts(state.pool), state}
  end

  def handle_call({:rebuild, _data_dir, _tier}, _from, %{pool: nil} = state) do
    {:reply, {:error, :not_configured}, state}
  end

  def handle_call({:rebuild, data_dir, tier}, _from, state) do
    {:reply, Occurrences.rebuild(state.pool, data_dir, tier), state}
  end

  def handle_call({:load_prepared, _p, _g, _m}, _from, %{pool: nil} = state) do
    {:reply, {:error, :not_configured}, state}
  end

  def handle_call({:load_prepared, positions_path, games_path, moves_path}, _from, state) do
    {:reply, Occurrences.load_prepared(state.pool, positions_path, games_path, moves_path), state}
  end

  def handle_call({:export_game, _gid}, _from, %{pool: nil} = state) do
    {:reply, {:error, :not_configured}, state}
  end

  def handle_call({:export_game, gid}, _from, state) do
    {:reply, GameExport.tree(gid, state.pool), state}
  end
end
