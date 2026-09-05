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
  timed (brief §19); the timings ride along on the result — including
  `pg_ms`, the game/move hydration time in Postgres, broken out so the
  packed-corpus cost and the (cross-region) PG cost of a request can be
  told apart (Spike 09 Phase 3).

  The pipeline lives behind the `Blunderfest.Corpus` boundary and only
  talks to the facade. Count questions go through `Corpus.position_stats/1`
  (header-backed on packed v2) via the request-scoped memo; occurrence
  lists are always bounded (`Corpus.occurrences/2`) — the pipeline never
  calls the unbounded `all_occurrences/1` on a live path.
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
  alias Blunderfest.Corpus.Search.CountMemo

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
          |> Keyword.put(:count_memo, CountMemo.new())
        )
      end)

    ref = gen.reference
    memo = gen.count_memo

    # One batch query for the bounded occurrence list's continuations — a
    # hot key's family build is one round trip, not N GenServer calls. The
    # query is Postgres hydration, timed apart from the local family build
    # so the two costs stay distinguishable.
    {menu_pg_us, moves_map} =
      :timer.tc(fn ->
        gen.exact_occurrences
        |> Enum.map(fn {gid, _ply} -> gid end)
        |> then(fn gids ->
          case Blunderfest.Corpus.moves_for(gids) do
            {:error, _} -> %{}
            map -> map
          end
        end)
      end)

    {menu_us, {menu, member_index}} =
      :timer.tc(fn ->
        menu =
          gen.exact_occurrences
          |> Enum.map(fn {gid, ply} ->
            {gid, ply, Map.get(moves_map, gid, []) |> drop_ply(ply)}
          end)
          |> Families.build(family_cfg)

        # The per-card membership layers score this same menu against every
        # card; the index precomputes each member's representations once
        # (request-local, threaded like the count memo — Spike HE-CPU).
        {menu, Families.member_index(menu, family_cfg, ref.stm)}
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

    # Total occurrence/game counts — reused from the request-scoped memo,
    # which candidate generation already populated with the reference key
    # (no second query). The hot-key path does not materialize the
    # occurrence list.
    {ref_counts_result, memo} = CountMemo.fetch(memo, ref_key)

    ref_counts =
      case ref_counts_result do
        {:error, _} -> Counts.counts(gen.exact_occurrences)
        counts -> counts
      end

    {evidence_us, {candidates, {_memo, cards_pg_us}}} =
      :timer.tc(fn ->
        (gen.exact ++ gen.structural)
        |> Enum.map_reduce({memo, 0}, fn cand, {memo, pg_us} ->
          {card_map, memo, card_pg_us} =
            card(
              cand,
              ref,
              member_index,
              family_cfg,
              skeleton_threshold,
              route,
              ref_ply,
              ref_window,
              memo
            )

          {card_map, {memo, pg_us + card_pg_us}}
        end)
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
        evidence_ms: div(evidence_us, 1000),
        pg_ms: div(menu_pg_us + cards_pg_us, 1000)
      }
    }
  end

  defp card(
         cand,
         ref,
         member_index,
         family_cfg,
         skeleton_threshold,
         route,
         ref_ply,
         ref_window,
         memo
       ) do
    # The card's two Postgres lookups (game metadata + mainline), timed as
    # hydration — on the far region this is where cross-region latency
    # lands, and the timing keeps it separable from the local assembly.
    {pg_us, {game_row, cand_moves}} =
      :timer.tc(fn -> {Blunderfest.Corpus.game(cand.gid), Blunderfest.Corpus.moves(cand.gid)} end)

    window = cand_moves |> drop_ply(cand.ply) |> cap()

    positional_diffs = Differences.positional(ref, cand.features)
    continuation_diffs = Differences.continuation(ref, cand.features, ref_window, window)

    family = Families.membership_indexed(member_index, window, family_cfg)

    skeleton =
      Skeleton.membership_indexed(
        member_index,
        window,
        cand.features.stm,
        family_cfg.window,
        skeleton_threshold
      )

    # Counts only — the card never needs the occurrence list itself, and a
    # hot key shared by many exact cards is counted once per request via the
    # memo (Spike 09 Horizon 1; Phase 3 serves it from the v2 headers).
    {historical, memo} = card_counts(cand.key, memo)
    same_game_only = Counts.same_game_only?(historical)

    {
      %{
        id: cand.id,
        strategy: cand.strategy,
        stm: cand.features.stm,
        key: cand.key,
        fen: Features.fen(cand.key),
        gid: cand.gid,
        ply: cand.ply,
        game: game_row,
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
      },
      memo,
      pg_us
    }
  end

  # Counts only — the card never needs the occurrence list itself. The
  # memo's fetcher is `Corpus.position_stats/1`; the full-list branch is a
  # last-resort fallback for a facade error and is the only place the
  # pipeline touches the explicitly unbounded API.
  defp card_counts(key, memo) do
    case CountMemo.fetch(memo, key) do
      {%{} = counts, memo} ->
        {counts, memo}

      {{:error, _}, memo} ->
        {Counts.counts(Blunderfest.Corpus.all_occurrences(key)), memo}
    end
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
