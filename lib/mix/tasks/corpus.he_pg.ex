defmodule Mix.Tasks.Corpus.HePg do
  @shortdoc "HE PostgreSQL hydration spike harness: round-trip census, RTT probe, payload"

  @moduledoc """
  The Historical Evidence PostgreSQL hydration spike harness
  (`docs/historical-evidence-postgre-sql-hydration-cross-region-latency.md`,
  Phases B/C/E/K):

      mix corpus.he_pg [--packed-dir data/corpus-packed-broadcast-v2]
        [--position start|e4|d4|najdorf|f1|a2|rare|endgame|all]
        [--reps N] [--rtt N] [--rtt-gid GID] [--payload]

    * default: one warm HE run per selected position with a trace of the
      Corpus facade — the PG call census (round trips per query kind, the
      gids requested, duplicates, and what the menu's `moves_for` already
      covers) plus the pipeline's stage timings;
    * `--reps N`: repeat the traced run N times (timing variance only —
      the census is taken from the first run);
    * `--rtt N`: the minimal-query round-trip probe — `Corpus.game/1`
      (a primary-key lookup) repeated N times, reporting min/median/p90/max.
      Run it colocated (ams/docker) and cross-region (ord) to establish
      the RTT the round-trip census multiplies;
    * `--payload`: approximate hydration payload size (rows + bytes via
      `:erlang.external_size`) for the per-card shape and the bulk shape.

  Requires DATABASE_URL pointing at the corpus Postgres carrying the
  games/moves tier of the packed directory.
  """

  use Mix.Task

  alias Blunderfest.Corpus
  alias Blunderfest.Corpus.Packed
  alias Blunderfest.Corpus.PositionKey
  alias Blunderfest.Corpus.Search.Pipeline

  @requirements ["app.start"]

  @positions %{
    "start" => {"start", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"},
    "e4" => {"after 1.e4", "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"},
    "d4" => {"after 1.d4", "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1"},
    "najdorf" => {"Najdorf", "rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 7"},
    "f1" => {"F1 (KID)", "r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1 w - - 0 9"},
    "a2" => {"A2 (Ruy)", "r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 b kq - 0 8"},
    "rare" =>
      {"rare middlegame", "r1bq1rk1/ppp2ppp/2n2n2/3p4/3P4/2NBPN2/PP3PPP/R1BQ1RK1 w - - 0 8"},
    "endgame" => {"cold endgame", "8/8/2k5/3p4/8/2K1P3/8/8 w - - 0 40"}
  }

  @order ["start", "e4", "d4", "najdorf", "f1", "a2", "rare", "endgame"]

  @impl Mix.Task
  def run(args) do
    {opts, _rest} =
      OptionParser.parse!(args,
        strict: [
          packed_dir: :string,
          position: :string,
          reps: :integer,
          rtt: :integer,
          rtt_gid: :integer,
          payload: :boolean
        ]
      )

    config = Application.get_env(:blunderfest, Blunderfest.Corpus) || []

    packed_dir =
      Keyword.get(opts, :packed_dir, config[:packed_dir] || "data/corpus-packed")

    config[:db] || Mix.raise("no corpus database configured — set DATABASE_URL")

    {:ok, backend} = Packed.open(packed_dir)

    corpus_state = :sys.get_state(Corpus)
    :sys.replace_state(Corpus, fn st -> %{st | packed: backend} end)

    try do
      keys = selected(opts)

      Mix.shell().info("packed dir: #{packed_dir}")
      Mix.shell().info("warming the corpus (one touch per position)…")
      Enum.each(keys, fn {_label, key} -> warm(key) end)

      cond do
        opts[:rtt] -> rtt(opts[:rtt], Keyword.get(opts, :rtt_gid, 1))
        true -> census(keys, opts)
      end
    after
      :sys.replace_state(Corpus, fn _ -> corpus_state end)
      Packed.close(backend)
    end
  end

  defp census(keys, opts) do
    reps = Keyword.get(opts, :reps, 1)

    Enum.each(keys, fn {label, key} ->
      {result, trace} = traced_analyze(key)
      t = result.timings

      Mix.shell().info("""

      ## #{label}

      total #{t.total_ms}ms (candidates #{t.candidates_ms} / menu #{t.menu_ms} / evidence #{t.evidence_ms} / pg #{t.pg_ms}) · #{length(result.candidates)} cards
      #{census_lines(trace, result)}
      """)

      if opts[:payload], do: payload_lines(trace, result)

      if reps > 1 do
        totals =
          for _ <- 2..reps do
            {r, _} = traced_analyze(key)
            r.timings.total_ms
          end

        all = [t.total_ms | totals]

        Mix.shell().info("   reps #{Enum.join(all, ", ")} ms — median #{median(all)}")
      end
    end)
  end

  ## The round-trip census (Phase B/E): trace the facade GenServer for the
  ## duration of one request. Every corpus query is a `$gen_call` through
  ## this one process, so the received messages are the complete call
  ## census — PG-bound kinds in packed mode: :game, :moves, :moves_for.

  defp traced_analyze(key) do
    corpus = Process.whereis(Corpus)
    :erlang.trace(corpus, true, [:receive])

    result = Pipeline.analyze(key, [])

    :erlang.trace(corpus, false, [:receive])
    {result, drain_trace([])}
  end

  defp census_lines(trace, result) do
    calls =
      for {:trace, _pid, :receive, {:"$gen_call", _from, call}} <- trace, do: call

    kinds = Enum.frequencies_by(calls, &call_kind/1)

    moves_for_calls = for {:moves_for, gids} <- calls, do: gids
    games_calls = for {:games, gids} <- calls, do: gids

    menu_gids = moves_for_calls |> List.flatten() |> Enum.uniq()
    card_gids = result.candidates |> Enum.map(& &1.gid)
    unique_card_gids = Enum.uniq(card_gids)
    covered = Enum.filter(unique_card_gids, &(&1 in menu_gids))

    pg_trips =
      (kinds[:game] || 0) + (kinds[:games] || 0) + (kinds[:moves] || 0) +
        (kinds[:moves_for] || 0)

    lines = [
      "facade calls: #{inspect(Map.new(kinds, fn {k, v} -> {kind_label(k), v} end))}",
      "PG round trips (packed mode): #{pg_trips} — #{Enum.join(query_census(kinds), " + ")}",
      "cards #{length(card_gids)} · unique card gids #{length(unique_card_gids)} · duplicate card gid occurrences #{length(card_gids) - length(unique_card_gids)}",
      "menu moves_for gids #{length(menu_gids)} · card gids already covered by it #{length(covered)} · fetched separately #{length(unique_card_gids) - length(covered)}"
    ]

    lines =
      case games_calls do
        [] -> lines
        [gids] -> lines ++ ["bulk games gid array: #{length(gids)} (deduped)"]
      end

    Enum.join(lines, "\n")
  end

  defp kind_label({:games, _gids}), do: :games
  defp kind_label(other), do: other

  defp query_census(kinds) do
    [
      {kinds[:game] || 0, "game"},
      {kinds[:games] || 0, "games"},
      {kinds[:moves] || 0, "moves"},
      {kinds[:moves_for] || 0, "moves_for"}
    ]
    |> Enum.reject(fn {n, _} -> n == 0 end)
    |> Enum.map(fn {n, label} -> "#{n} #{label}" end)
  end

  defp call_kind({:game, _}), do: :game
  defp call_kind({:games, _}), do: :games
  defp call_kind({:moves, _}), do: :moves
  defp call_kind({:moves_for, _}), do: :moves_for
  defp call_kind({:occurrences, _}), do: :occurrences
  defp call_kind({:occurrences, _, _}), do: :occurrences
  defp call_kind({:position_stats, _}), do: :position_stats
  defp call_kind({:first_occurrence, _}), do: :first_occurrence
  defp call_kind({:pawn_bucket, _}), do: :pawn_bucket
  defp call_kind({:pawn_bucket, _, _}), do: :pawn_bucket
  defp call_kind({:book, _}), do: :book
  defp call_kind({:book_counts, _}), do: :book_counts
  defp call_kind({:position, _}), do: :position
  defp call_kind(other), do: other

  ## Payload (Phase K): rows + approximate bytes for the two hydration
  ## shapes. The per-card shape is reconstructed by re-running the
  ## individual lookups for the request's cards (the pipeline no longer
  ## makes them); the bulk shape is measured from the actual bulk calls.

  defp payload_lines(trace, result) do
    calls =
      for {:trace, _pid, :receive, {:"$gen_call", _from, call}} <- trace, do: call

    menu_gids =
      calls
      |> Enum.flat_map(fn
        {:moves_for, gids} -> gids
        _ -> []
      end)
      |> Enum.uniq()

    card_gids = result.candidates |> Enum.map(& &1.gid)
    unique_card_gids = Enum.uniq(card_gids)

    menu_map = Corpus.moves_for(menu_gids)
    menu_bytes = :erlang.external_size(menu_map)

    # The pre-batching shape: one game + one moves query per card, with
    # duplicate gids fetched again (exactly what the old pipeline did).
    {game_rows, game_bytes} = sized_results(card_gids, &Corpus.game/1)
    {move_rows, move_bytes} = sized_results(card_gids, &Corpus.moves/1)

    # The batched shape as the pipeline now issues it.
    games_map = Corpus.games(unique_card_gids)
    missing = Enum.reject(unique_card_gids, &Map.has_key?(menu_map, &1))
    bulk_missing = if missing == [], do: %{}, else: Corpus.moves_for(missing)

    Mix.shell().info("""
    payload (approx, :erlang.external_size):
      menu moves_for: #{map_size(menu_map)} rows / #{kb(menu_bytes)} KB (one query, #{length(menu_gids)} gids)
      before — per-card game:  #{game_rows} queries / #{kb(game_bytes)} KB
      before — per-card moves: #{move_rows} queries / #{kb(move_bytes)} KB
      after  — games(#{length(unique_card_gids)} gids): 1 query / #{kb(:erlang.external_size(games_map))} KB; moves_for(#{length(missing)} missing): #{if missing == [], do: "0 queries", else: "1 query / #{kb(:erlang.external_size(bulk_missing))} KB"}
    """)
  end

  defp sized_results(gids, fun) do
    results = Enum.map(gids, fun)
    {length(gids), :erlang.external_size(results)}
  end

  ## Minimal-query RTT probe (Phase C): one primary-key lookup, repeated.

  defp rtt(reps, gid) do
    _ = Corpus.game(gid)

    times =
      for _ <- 1..reps do
        {us, _} = :timer.tc(fn -> Corpus.game(gid) end)
        us
      end

    sorted = Enum.sort(times)

    Mix.shell().info("""
    RTT probe — Corpus.game(#{gid}), #{reps} reps (µs):
      min #{hd(sorted)} / median #{median(sorted)} / p90 #{p(sorted, 90)} / p95 #{p(sorted, 95)} / max #{List.last(sorted)}
      all: #{Enum.join(sorted, " ")}
    """)
  end

  ## Helpers (same shape as corpus.he_cpu)

  defp selected(opts) do
    case Keyword.get(opts, :position, "all") do
      "all" ->
        Enum.map(@order, fn name ->
          {label, fen} = Map.fetch!(@positions, name)
          {label, key_of_fen(fen)}
        end)

      name ->
        case Map.fetch(@positions, name) do
          {:ok, {label, fen}} -> [{label, key_of_fen(fen)}]
          :error -> Mix.raise("unknown position #{name} — one of: #{Enum.join(@order, ", ")}")
        end
    end
  end

  defp key_of_fen(fen) do
    {:ok, key} = PositionKey.from_fen(fen)
    key
  end

  defp warm(key) do
    _ = Corpus.position_stats(key)
    _ = Corpus.occurrences(key, 12)

    case Corpus.position(key) do
      %{pawn_hash: pawn_hash} -> Corpus.pawn_bucket(pawn_hash, 2000)
      _ -> []
    end

    :ok
  end

  defp drain_trace(acc) do
    receive do
      msg -> drain_trace([msg | acc])
    after
      0 -> Enum.reverse(acc)
    end
  end

  defp median(list) do
    sorted = Enum.sort(list)
    Enum.at(sorted, div(length(sorted), 2))
  end

  defp p(sorted, pct) do
    n = length(sorted)
    Enum.at(sorted, min(div(n * pct, 100), n - 1))
  end

  defp kb(bytes), do: Float.round(bytes / 1024, 1)
end
