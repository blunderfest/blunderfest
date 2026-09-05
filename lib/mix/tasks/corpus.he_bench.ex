defmodule Mix.Tasks.Corpus.HeBench do
  @shortdoc "Phase 3 benchmark suite: bounded Corpus API + Historical Evidence gate"

  @moduledoc """
  The Spike 09 Phase 3 local benchmark suite:

      mix corpus.he_bench [--packed-dir data/corpus-packed-broadcast-v2] [--reps 200]

  For the eight permanent reference positions (start, after 1.e4, after
  1.d4, Najdorf, F1, A2, rare middlegame, cold endgame):

    * `position_stats` latency (warm; must stay independent of run length);
    * bounded `occurrences(limit)` at 1 / 12 / 2000 (warm);
    * Historical Evidence total latency with the pipeline's own stage
      timings (candidates / menu / evidence / PG hydration);
    * peak BEAM memory during the HE run (50 ms sampler on
      `:erlang.memory(:total)`).

  Plus a start-position concurrency probe (n = 1 / 2 / 4) — recorded for
  the later GenServer decision, not a gate — and the Phase 3 product gate:

      start-position HE: < 1 second, < 300 MB peak memory

  Run it against a v1 and a v2 directory for the before/after comparison.
  The corpus must be warm for the main numbers (the task warms each
  position once before measuring); cold behavior is a first-run effect of
  the bucket/anchor page cache. Requires DATABASE_URL pointing at the
  corpus Postgres carrying the games/moves tier of the packed directory.
  """

  use Mix.Task

  alias Blunderfest.Corpus
  alias Blunderfest.Corpus.Packed
  alias Blunderfest.Corpus.PositionKey
  alias Blunderfest.Corpus.Search.Pipeline

  @requirements ["app.start"]

  @positions [
    {"start", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"},
    {"after 1.e4", "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"},
    {"after 1.d4", "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1"},
    {"Najdorf", "rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 7"},
    {"F1 (KID)", "r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1 w - - 0 9"},
    {"A2 (Ruy)", "r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 b kq - 0 8"},
    {"rare middlegame", "r1bq1rk1/ppp2ppp/2n2n2/3p4/3P4/2NBPN2/PP3PPP/R1BQ1RK1 w - - 0 8"},
    {"cold endgame", "8/8/2k5/3p4/8/2K1P3/8/8 w - - 0 40"}
  ]

  @limits [1, 12, 2000]

  @impl Mix.Task
  def run(args) do
    {opts, _rest} =
      OptionParser.parse!(args, strict: [packed_dir: :string, reps: :integer])

    config = Application.get_env(:blunderfest, Blunderfest.Corpus) || []

    packed_dir =
      Keyword.get(opts, :packed_dir, config[:packed_dir] || "data/corpus-packed")

    reps = Keyword.get(opts, :reps, 200)

    config[:db] || Mix.raise("no corpus database configured — set DATABASE_URL")

    {:ok, backend} = Packed.open(packed_dir)

    versions = backend.segments |> Enum.map(&"pos v#{&1.pos_version}") |> Enum.join(", ")
    Mix.shell().info("packed dir: #{packed_dir} (#{versions})")

    corpus_state = :sys.get_state(Corpus)
    :sys.replace_state(Corpus, fn st -> %{st | packed: backend} end)

    try do
      keys =
        Enum.map(@positions, fn {label, fen} ->
          {:ok, key} = PositionKey.from_fen(fen)
          {label, key}
        end)

      Mix.shell().info("warming the corpus (one touch per position)…")
      Enum.each(keys, fn {_label, key} -> warm(key) end)

      baseline_mb = mb(:erlang.memory(:total))
      Mix.shell().info("baseline BEAM total: #{baseline_mb} MB\n")

      api_lines = Enum.map(keys, &api_bench(&1, reps))

      Mix.shell().info("""

      ## API microbenchmarks (warm, µs)

      #{Enum.join(api_lines, "\n")}
      """)

      he_lines = Enum.map(keys, &he_bench/1)

      Mix.shell().info("""

      ## Historical Evidence (warm, defaults)

      #{Enum.join(he_lines, "\n")}
      """)

      gate = gate(keys)
      Mix.shell().info("\n#{gate}\n")

      concurrency = concurrency_report()
      Mix.shell().info("\n#{concurrency}")
    after
      :sys.replace_state(Corpus, fn _ -> corpus_state end)
      Packed.close(backend)
    end
  end

  ## Warm-up: one stats lookup, one bounded read, one bucket touch (the
  ## candidates stage's bucket scan is cache-sensitive; a warm corpus means
  ## warm buckets).

  defp warm(key) do
    _ = Corpus.position_stats(key)
    _ = Corpus.occurrences(key, 12)

    case Corpus.position(key) do
      %{pawn_hash: pawn_hash} -> Corpus.pawn_bucket(pawn_hash, 2000)
      _ -> []
    end

    :ok
  end

  ## API microbenchmarks

  defp api_bench({label, key}, reps) do
    stats_times = for _ <- 1..reps, do: timed(fn -> Corpus.position_stats(key) end)

    bounded =
      for limit <- @limits do
        times = for _ <- 1..div(reps, 4), do: timed(fn -> Corpus.occurrences(key, limit) end)
        {limit, stats(times)}
      end

    stats = Corpus.position_stats(key)
    bounded_str = Enum.map_join(bounded, "  ", fn {l, s} -> "limit #{l}: #{s}" end)

    "#{label} (#{stats.occurrences} occ / #{stats.games} games):\n" <>
      "  position_stats: #{stats(stats_times)}\n  #{bounded_str}"
  end

  ## Historical Evidence

  defp he_bench({label, key}) do
    {peak_mb, result} = with_peak(fn -> Pipeline.analyze(key, []) end)

    t = result.timings

    "#{label}: total #{t.total_ms}ms " <>
      "(candidates #{t.candidates_ms} / menu #{t.menu_ms} / evidence #{t.evidence_ms} / pg #{t.pg_ms}) " <>
      "· candidates #{length(result.candidates)} · peak #{peak_mb} MB"
  end

  ## The Phase 3 product gate (Spike 09 §13): start position.

  defp gate(keys) do
    {"start", start_key} = Enum.find(keys, fn {label, _key} -> label == "start" end)

    runs =
      for _ <- 1..5 do
        {peak_mb, result} = with_peak(fn -> Pipeline.analyze(start_key, []) end)
        {result.timings.total_ms, peak_mb}
      end

    {ms_list, mb_list} = Enum.unzip(runs)
    median_ms = median(ms_list)
    max_mb = Enum.max(mb_list)

    verdict =
      if median_ms < 1000 and max_mb < 300 do
        "GATE PASS"
      else
        "GATE MISS"
      end

    "## Phase 3 gate — start-position HE (5 runs)\n" <>
      "total ms: #{Enum.join(ms_list, ", ")} (median #{median_ms}) · peak MB: #{Enum.join(mb_list, ", ")}\n" <>
      "#{verdict}: requires median < 1s and peak < 300 MB"
  end

  ## Concurrency probe (recorded for the later GenServer decision).

  defp concurrency_report do
    {:ok, start_key} =
      PositionKey.from_fen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")

    lines =
      for n <- [1, 2, 4] do
        {peak_mb, wall_ms} =
          with_peak(fn ->
            {us, _} =
              :timer.tc(fn ->
                1..n
                |> Enum.map(fn _ -> Task.async(fn -> Pipeline.analyze(start_key, []) end) end)
                |> Enum.each(&Task.await(&1, :infinity))
              end)

            div(us, 1000)
          end)

        "n=#{n}: wall #{wall_ms}ms · peak #{peak_mb} MB"
      end

    "## Concurrency probe (start position)\n" <> Enum.join(lines, "\n")
  end

  ## Memory sampling

  # Runs `fun` with a 50 ms sampler on `:erlang.memory(:total)`; returns
  # `{peak_mb, fun_result}`. Peak is the absolute BEAM total (baseline is
  # reported separately by the caller).
  defp with_peak(fun) do
    parent = self()
    sampler = spawn(fn -> sample_loop(parent, 50) end)
    result = fun.()
    samples = stop_sampler(sampler)
    peak_mb = samples |> Enum.max(fn -> :erlang.memory(:total) end) |> mb()
    {peak_mb, result}
  end

  defp sample_loop(parent, interval) do
    receive do
      :stop -> send(parent, :sampler_stopped)
    after
      interval ->
        send(parent, {:mem_sample, :erlang.memory(:total)})
        sample_loop(parent, interval)
    end
  end

  defp stop_sampler(sampler) do
    ref = Process.monitor(sampler)
    send(sampler, :stop)

    receive do
      :sampler_stopped -> :ok
    after
      1_000 -> :ok
    end

    receive do
      {:DOWN, ^ref, :process, ^sampler, _reason} -> :ok
    after
      1_000 -> :ok
    end

    drain_samples([])
  end

  defp drain_samples(acc) do
    receive do
      {:mem_sample, bytes} -> drain_samples([bytes | acc])
    after
      0 -> Enum.reverse(acc)
    end
  end

  ## Helpers

  defp timed(fun) do
    {us, _} = :timer.tc(fun)
    us
  end

  defp stats(times) do
    sorted = Enum.sort(times)
    n = length(sorted)

    "p50=#{Enum.at(sorted, div(n, 2))}µs p95=#{Enum.at(sorted, min(div(n * 95, 100), n - 1))}µs max=#{List.last(sorted)}µs"
  end

  defp median(list) do
    sorted = Enum.sort(list)
    Enum.at(sorted, div(length(sorted), 2))
  end

  defp mb(bytes), do: Float.round(bytes / 1024 / 1024, 1)
end
