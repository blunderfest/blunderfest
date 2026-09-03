defmodule Blunderfest.Corpus.Search.Pipeline do
  @moduledoc """
  The historical-evidence pipeline (design brief §2's vertical slice): one
  reference position in, a structured evidence result out.

  Stages, in order:

      candidate generation → position comparison → route / difference
      analysis → continuation analysis → continuation / plan families →
      historical counts → per-candidate evidence

  No stage fuses its signals into a relevance score (brief §16): the
  result exposes facts — typed differences, routes, family memberships,
  counts — and the consumer decides what is interesting. Every stage is
  timed (brief §19); the timings ride along on the result.

  The pipeline lives behind the `Blunderfest.Corpus` boundary and only
  talks to the facade.
  """

  alias Blunderfest.Corpus.Analysis.{
    Counts,
    Differences,
    Families,
    Features,
    Route,
    Skeleton
  }

  alias Blunderfest.Corpus.Search.Candidates

  @window_cap 12

  @type opts :: [
          {:route, [String.t()] | nil}
          | {:reference_moves, [String.t()] | nil}
          | {:exact_limit, pos_integer()}
          | {:limit, pos_integer()}
          | {:bucket_limit, pos_integer()}
          | {:family_cfg, Families.cfg()}
          | {:skeleton_threshold, float()}
        ]

  @doc """
  Runs the pipeline for a reference key. `opts[:reference_moves]` (full
  mainline of the reference game, if the analysis is anchored to one)
  yields both the route and the reference continuation window; `opts
  [:route]` supplies only the route (moves leading to the position).
  """
  @spec analyze(String.t(), opts()) :: map()
  def analyze(ref_key, opts \\ []) do
    {total_us, result} = :timer.tc(fn -> do_analyze(ref_key, opts) end)
    Map.update!(result, :timings, &Map.put(&1, :total_ms, div(total_us, 1000)))
  end

  defp do_analyze(ref_key, opts) do
    family_cfg = Keyword.get(opts, :family_cfg, Families.default())
    skeleton_threshold = Keyword.get(opts, :skeleton_threshold, 0.5)

    ref_moves = Keyword.get(opts, :reference_moves)
    route = Keyword.get(opts, :route) || ref_moves
    ref_ply = Keyword.get(opts, :ref_ply) || if(route, do: length(route))

    {candidates_us, gen} =
      :timer.tc(fn ->
        Candidates.generate(
          ref_key,
          Keyword.take(opts, [:exact_limit, :limit, :bucket_limit, :scan_limit])
        )
      end)

    ref = gen.reference

    {menu_us, menu} =
      :timer.tc(fn ->
        # One batch query for the bounded occurrence list's continuations —
        # a hot key's family build is one round trip, not N GenServer calls.
        moves_map =
          gen.exact_occurrences
          |> Enum.map(fn {gid, _ply} -> gid end)
          |> then(fn gids ->
            case Blunderfest.Corpus.moves_for(gids) do
              {:error, _} -> %{}
              map -> map
            end
          end)

        gen.exact_occurrences
        |> Enum.map(fn {gid, ply} ->
          {gid, ply, Map.get(moves_map, gid, []) |> drop_ply(ply)}
        end)
        |> Families.build(family_cfg)
      end)

    # The next-move distribution is computed in SQL via the corpus Book
    # (independent games per move — the same per-(gid,move) dedupe the
    # per-occurrence path used, without fetching every occurrence).
    next_moves =
      case Blunderfest.Corpus.book(Features.fen(ref_key)) do
        {:error, _} ->
          []

        rows ->
          Enum.map(rows, fn row -> %{move: row.move, games: row.games} end)
      end

    ref_window =
      if ref_moves do
        ref_moves |> drop_ply(ref_ply) |> cap()
      else
        []
      end

    # Total occurrence/game counts in one SQL query (the hot-key path does
    # not materialize the occurrence list).
    ref_counts =
      case Blunderfest.Corpus.occurrence_counts(ref_key) do
        {:error, _} -> Counts.counts(gen.exact_occurrences)
        counts -> counts
      end

    {evidence_us, candidates} =
      :timer.tc(fn ->
        (gen.exact ++ gen.structural)
        |> Enum.map(
          &card(&1, ref, menu, family_cfg, skeleton_threshold, route, ref_ply, ref_window)
        )
      end)

    %{
      reference: %{
        key: ref_key,
        fen: Features.fen(ref_key),
        stm: ref.stm,
        historical: ref_counts,
        families: menu,
        next_moves: next_moves
      },
      candidates: candidates,
      timings: %{
        candidates_ms: div(candidates_us, 1000),
        menu_ms: div(menu_us, 1000),
        evidence_ms: div(evidence_us, 1000)
      }
    }
  end

  defp card(cand, ref, menu, family_cfg, skeleton_threshold, route, ref_ply, ref_window) do
    cand_moves = Blunderfest.Corpus.moves(cand.gid)
    window = cand_moves |> drop_ply(cand.ply) |> cap()

    positional_diffs = Differences.positional(ref, cand.features)
    continuation_diffs = Differences.continuation(ref, cand.features, ref_window, window)

    family = Families.membership(menu, window, family_cfg)

    skeleton =
      Skeleton.membership(
        menu,
        window,
        cand.features.stm,
        ref.stm,
        family_cfg.window,
        skeleton_threshold
      )

    # Counts only (no occurrence-list fetch): the card needs
    # occurrences/games/same_game_only, all derivable from the aggregate —
    # `occurrence_counts` is a single bounded read in the packed backend
    # (and a COUNT(*), COUNT(DISTINCT gid) in PG), so a hot candidate key
    # never re-reads its occurrence run per card.
    historical =
      case Blunderfest.Corpus.occurrence_counts(cand.key) do
        {:error, _} -> Counts.counts(Blunderfest.Corpus.occurrences(cand.key))
        counts -> counts
      end

    same_game_only = historical.occurrences > 1 and historical.games == 1

    %{
      id: cand.id,
      strategy: cand.strategy,
      stm: cand.features.stm,
      key: cand.key,
      fen: Features.fen(cand.key),
      gid: cand.gid,
      ply: cand.ply,
      game: Blunderfest.Corpus.game(cand.gid),
      position: %{
        dims: cand.dims,
        typed_differences: positional_diffs
      },
      route:
        Route.compare(route && Enum.take(route, ref_ply || 0), ref_ply, cand_moves, cand.ply),
      continuation: %{
        window: window,
        typed_differences: continuation_diffs
      },
      families: %{
        membership: family,
        skeleton_white: skeleton.white,
        skeleton_black: skeleton.black
      },
      historical: %{
        occurrences: historical.occurrences,
        games: historical.games,
        same_game_only: same_game_only
      },
      flags:
        flags(
          positional_diffs,
          continuation_diffs,
          family,
          historical,
          same_game_only
        )
    }
  end

  defp flags(positional_diffs, continuation_diffs, family, historical, same_game_only) do
    flags =
      []
      |> then(&if(same_game_only, do: [:same_game_only | &1], else: &1))
      |> then(
        &if(family.status == :member and Counts.singleton?(family.family_games),
          do: [:singleton_family | &1],
          else: &1
        )
      )
      |> then(
        &if(Counts.singleton?(historical.games) and historical.occurrences == 1,
          do: [:singleton | &1],
          else: &1
        )
      )
      |> Enum.reverse()

    flags ++ Enum.map(positional_diffs ++ continuation_diffs, & &1.type)
  end

  defp drop_ply(moves, ply), do: Enum.drop(moves, ply)

  defp cap(moves), do: Enum.take(moves, @window_cap)
end
