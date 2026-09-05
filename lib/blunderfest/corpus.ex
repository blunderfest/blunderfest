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

  ## Occurrence backends (Spike 08)

  `occurrence_backend: :postgres` (default) serves the occurrence layer
  (`occurrences`, `occurrence_counts`, `position`, `pawn_bucket`, and the
  book aggregates) from the Postgres tables. `occurrence_backend: :packed`
  serves them from the packed binary segment directory at `packed_dir`
  instead; games, moves, game metadata, and game export always come from
  Postgres (the spike replaces the occurrence store, not game storage —
  brief §8). In packed mode the book aggregate comes from the precomputed
  `book.bin`.

  ## Cost-explicit occurrence API (Spike 09 Phase 3)

  The occurrence queries come in cost-explicit variants so a caller cannot
  accidentally pay O(run length) for a count question on a hot key:

      API                        Cost (packed v2)
      position_stats/1           O(segment/header lookup) — never walks the run
      first_occurrence/1         O(segment/header lookup) — never reads occ.bin
      occurrences/2 (limit)      O(segment lookup + min(limit, run length))
      all_occurrences/1          O(full run) — explicitly unbounded
      occurrence_counts/1        legacy alias of position_stats/1
      occurrences/1              legacy alias of all_occurrences/1

  On packed format v1 (no stored run statistics) `position_stats/1` falls
  back to the run-walking count (correct, O(run)) rather than fabricating
  metadata; bounded reads fall back to whole-run reads with a prefix decode
  (the Phase 0 behavior). Postgres serves `position_stats/1` with the same
  `COUNT(*)` / `COUNT(DISTINCT gid)` query `occurrence_counts/1` always
  used, so both backends agree field for field.
  """

  use GenServer

  require Logger

  alias Blunderfest.Corpus.{Book, GameExport, Occurrences, Packed, PositionKey}

  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  ## Application-facing query API

  @doc "Whether a corpus database is configured (ADR-0026 graceful absence)."
  @spec configured?() :: boolean()
  def configured?, do: GenServer.call(__MODULE__, :configured?)

  @doc """
  Every occurrence of a canonical key as `[{gid, ply}]`, in game/ply order —
  explicitly unbounded, O(full run). Kept as a legacy alias of
  `all_occurrences/1`; new product code should call the cost-explicit name.
  """
  @spec occurrences(String.t()) :: [{pos_integer(), pos_integer()}] | {:error, :not_configured}
  def occurrences(key), do: GenServer.call(__MODULE__, {:occurrences, key}, :infinity)

  @doc """
  Every occurrence of a canonical key as `[{gid, ply}]`, in game/ply order.
  Explicitly unbounded — O(full run) read and decode on every call, so the
  cost is obvious at the call site. Hot keys (the start position carries
  ~1.17M occurrences) must never reach this from a product path; use
  `position_stats/1`, `first_occurrence/1` or `occurrences/2`.
  """
  @spec all_occurrences(String.t()) ::
          [{pos_integer(), pos_integer()}] | {:error, :not_configured}
  def all_occurrences(key), do: GenServer.call(__MODULE__, {:occurrences, key}, :infinity)

  @doc """
  The first `limit` occurrences of a canonical key in `(gid, ply)` order —
  the bounded variant for callers that only keep a prefix. Semantics equal
  `occurrences(key) |> Enum.take(limit)`. On packed format v2 the read
  scales with `min(limit, run length)`, never the full run (the limit
  applies to the complete logical result, not per segment).
  """
  @spec occurrences(String.t(), non_neg_integer()) ::
          [{pos_integer(), pos_integer()}] | {:error, :not_configured}
  def occurrences(key, limit),
    do: GenServer.call(__MODULE__, {:occurrences, key, limit}, :infinity)

  @doc """
  Total occurrence and independent-game counts for a canonical key —
  `%{occurrences, games}`. Packed format v2 answers from the stored
  position-header statistics (bounded, independent of run length); format
  v1 falls back to the run-walking count; Postgres runs the exact
  `COUNT(*)` / `COUNT(DISTINCT gid)` query. This is the product count API;
  `occurrence_counts/1` is its legacy alias.
  """
  @spec position_stats(String.t()) :: map() | {:error, :not_configured}
  def position_stats(key), do: GenServer.call(__MODULE__, {:position_stats, key}, :infinity)

  @doc """
  Total occurrence and independent-game counts for a canonical key, one
  query. Legacy alias of `position_stats/1` (identical results on every
  backend); kept for compatibility — new code calls `position_stats/1`.
  """
  @spec occurrence_counts(String.t()) :: map() | {:error, :not_configured}
  def occurrence_counts(key), do: GenServer.call(__MODULE__, {:position_stats, key}, :infinity)

  @doc """
  The globally earliest occurrence of a canonical key — `{gid, ply}` or nil
  when the position never occurs — without materializing the occurrence
  run. Semantics equal `occurrences(key) |> List.first()`. Packed answers
  from the position headers (both format versions); Postgres from the
  positions row.
  """
  @spec first_occurrence(String.t()) ::
          {pos_integer(), pos_integer()} | nil | {:error, :not_configured}
  def first_occurrence(key), do: GenServer.call(__MODULE__, {:first_occurrence, key}, :infinity)

  @doc "The position row for a canonical key, or nil if never seen."
  @spec position(String.t()) :: map() | nil | {:error, :not_configured}
  def position(key), do: GenServer.call(__MODULE__, {:position, key}, :infinity)

  @doc "Distinct canonical keys sharing a pawn-skeleton hash."
  @spec pawn_bucket(non_neg_integer()) :: [String.t()] | {:error, :not_configured}
  def pawn_bucket(pawn_hash), do: GenServer.call(__MODULE__, {:pawn_bucket, pawn_hash}, :infinity)

  @doc """
  Bounded bucket fetch (`Packed.pawn_bucket/3`) — the pipeline passes its
  own `bucket_limit` down after the broadcast-scale bucket measurements
  (the largest broadcast bucket resolves ~25 s unbounded).
  """
  @spec pawn_bucket(non_neg_integer(), pos_integer()) :: [String.t()] | {:error, :not_configured}
  def pawn_bucket(pawn_hash, limit),
    do: GenServer.call(__MODULE__, {:pawn_bucket, pawn_hash, limit}, :infinity)

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
    config = Application.get_env(:blunderfest, __MODULE__) || []
    db = config[:db]

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

    backend_choice = Keyword.get(config, :occurrence_backend, :postgres)

    packed =
      if backend_choice == :packed do
        # When the packed backend is explicitly configured, failing to open it
        # is a boot failure (never silently fall back to the Postgres
        # occurrence tables).
        {open_us, open_result} =
          :timer.tc(fn ->
            Packed.open(Keyword.get(config, :packed_dir, "data/corpus-packed"))
          end)

        case open_result do
          {:ok, backend} ->
            # Boot visibility (Spike 09): the anchor source decides whether a
            # boot costs milliseconds (sidecars) or a rebuild.
            sources = backend.segments |> Enum.map(& &1.anchors_from) |> Enum.uniq()

            Logger.info(
              "packed corpus open in #{div(open_us, 1000)}ms " <>
                "(#{length(backend.segments)} segment(s), anchors: #{Enum.join(sources, ",")})"
            )

            backend

          {:error, reason} ->
            raise("packed occurrence backend failed to open: #{inspect(reason)}")
        end
      else
        nil
      end

    {:ok, %{pool: pool, packed: packed}}
  end

  # The occurrence store is packed only when both the packed backend and the
  # Postgres pool (game storage) are up — a missing pool degrades the whole
  # facade to not_configured, same as before.
  defp occurrence_store(%{pool: pool, packed: packed}) do
    cond do
      pool == nil -> :unconfigured
      packed != nil -> {:packed, packed}
      true -> :postgres
    end
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
             :position_stats,
             :first_occurrence
           ] do
    {:reply, {:error, :not_configured}, state}
  end

  def handle_call({fun, _arg, _arg2}, _from, %{pool: nil} = state)
      when fun in [:occurrences, :pawn_bucket] do
    {:reply, {:error, :not_configured}, state}
  end

  def handle_call({:book, fen}, _from, state) do
    result =
      case occurrence_store(state) do
        {:packed, packed} ->
          case PositionKey.from_fen(fen) do
            {:error, _} -> {:error, :invalid_fen}
            {:ok, key} -> Packed.book(packed, PositionKey.to_hash128(key))
          end

        :postgres ->
          Book.for_fen(state.pool, fen)

        :unconfigured ->
          {:error, :not_configured}
      end

    {:reply, result, state}
  end

  def handle_call({:book_counts, fens}, _from, state) do
    fen_keys =
      fens
      |> Enum.uniq()
      |> Enum.flat_map(fn fen ->
        case PositionKey.from_fen(fen) do
          {:ok, key} -> [{fen, key}]
          {:error, _} -> []
        end
      end)

    counts =
      case occurrence_store(state) do
        {:packed, packed} ->
          # Independent-game support counts (Spike 09 §12.8): the v2
          # position header's game_count is authoritative — the old
          # book.bin per-move sum drops games without a recorded
          # continuation (−87,264 at the start position). v1 segments fall
          # back to the exact run-walking distinct-gid count.
          Map.new(fen_keys, fn {_fen, key} ->
            {key, packed_games_count(packed, PositionKey.to_hash128(key))}
          end)

        :postgres ->
          Book.counts_for_keys(state.pool, Enum.map(fen_keys, fn {_fen, key} -> key end))

        :unconfigured ->
          %{}
      end

    # A key can serve several FENs (FEN move-counter differences); map back,
    # dropping positions with no occurrences.
    result =
      for {fen, key} <- fen_keys,
          count = Map.get(counts, key),
          count !== nil and count > 0,
          into: %{} do
        {fen, count}
      end

    {:reply, result, state}
  end

  def handle_call({:occurrences, key}, _from, state) do
    result =
      case occurrence_store(state) do
        {:packed, packed} -> Packed.occurrences(packed, PositionKey.to_hash128(key))
        :postgres -> Occurrences.occurrences(state.pool, key)
        :unconfigured -> {:error, :not_configured}
      end

    {:reply, result, state}
  end

  def handle_call({:occurrences, key, limit}, _from, state) do
    result =
      case occurrence_store(state) do
        {:packed, packed} -> Packed.occurrences(packed, PositionKey.to_hash128(key), limit)
        :postgres -> Occurrences.occurrences(state.pool, key, limit)
        :unconfigured -> {:error, :not_configured}
      end

    {:reply, result, state}
  end

  def handle_call({:position_stats, key}, _from, state) do
    result =
      case occurrence_store(state) do
        {:packed, packed} -> packed_position_stats(packed, PositionKey.to_hash128(key))
        :postgres -> Occurrences.counts_for(state.pool, key)
        :unconfigured -> {:error, :not_configured}
      end

    {:reply, result, state}
  end

  def handle_call({:first_occurrence, key}, _from, state) do
    result =
      case occurrence_store(state) do
        {:packed, packed} -> Packed.first_occurrence(packed, PositionKey.to_hash128(key))
        :postgres -> Occurrences.first_occurrence(state.pool, key)
        :unconfigured -> {:error, :not_configured}
      end

    {:reply, result, state}
  end

  def handle_call({:position, key}, _from, state) do
    result =
      case occurrence_store(state) do
        {:packed, packed} -> Packed.position(packed, PositionKey.to_hash128(key))
        :postgres -> Occurrences.position(state.pool, key)
        :unconfigured -> {:error, :not_configured}
      end

    {:reply, result, state}
  end

  def handle_call({:pawn_bucket, pawn_hash}, _from, state) do
    result =
      case occurrence_store(state) do
        {:packed, packed} -> Packed.pawn_bucket(packed, pawn_hash)
        :postgres -> Occurrences.pawn_bucket(state.pool, pawn_hash)
        :unconfigured -> {:error, :not_configured}
      end

    {:reply, result, state}
  end

  def handle_call({:pawn_bucket, pawn_hash, limit}, _from, state) do
    result =
      case occurrence_store(state) do
        {:packed, packed} -> Packed.pawn_bucket(packed, pawn_hash, limit)
        :postgres -> Occurrences.pawn_bucket(state.pool, pawn_hash, limit)
        :unconfigured -> {:error, :not_configured}
      end

    {:reply, result, state}
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

  # Position stats from the packed backend (Phase 3): format v2 answers
  # from the stored header statistics — bounded, independent of run length.
  # A format-v1 segment holding the key has no stored stats; rather than
  # fabricate v2 metadata, fall back to the exact run-walking count (the
  # pre-Phase-3 implementation), keeping v1 directories a usable rollback.
  defp packed_position_stats(packed, hash) do
    case Packed.position_stats(packed, hash) do
      {:ok, stats} -> stats
      {:error, :format_v1} -> Packed.occurrence_counts(packed, hash)
    end
  end

  # Independent games for a key from the packed backend (the book_counts
  # fix): the v2 header's game_count, or the exact run-walking distinct-gid
  # count on v1. Never the book.bin per-move sum (Spike 09 §12.8).
  defp packed_games_count(packed, hash) do
    packed_position_stats(packed, hash).games
  end

  # In packed mode the facade routes :book to the precomputed book.bin
  # aggregate; :book_counts serves the authoritative independent-game count
  # (see the handle_call clauses above). `Book.for_key_packed/3` remains as
  # the non-precomputed book recomputation for the parity/he18 tasks.
end
