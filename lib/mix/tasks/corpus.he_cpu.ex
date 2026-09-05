defmodule Mix.Tasks.Corpus.HeCpu do
  @shortdoc "HE product-CPU spike harness: variance runs, computation graph, profiler hooks"

  @moduledoc """
  The Historical Evidence product-CPU spike harness
  (`docs/historical-evidence-product-cpu-families-build-card-assembly.md`,
  Phases A/B/D):

      mix corpus.he_cpu [--packed-dir data/corpus-packed-broadcast-v2]
        [--position start|e4|d4|najdorf|f1|a2|rare|endgame|all]
        [--reps 11] [--graph] [--eprof] [--cprof] [--dto]
        [--snapshot FILE] [--compare FILE]

    * default: one warm HE run per selected position with the pipeline's
      stage timings (like `corpus.he_bench`, minus the API microbenchmarks);
    * `--reps N`: repeat the selected position(s) N times and report every
      run plus min/median/p90/max — the variance characterization;
    * `--graph`: the start-position computation graph — how many windows,
      distinct sequences, pair comparisons, families, members, cards and
      derived membership operations one request performs;
    * `--eprof MODULES` / `--cprof`: wrap one pipeline run in the BEAM
      profiler. `--eprof` takes a comma list of short module names to trace
      (e.g. `Continuation,Families,Skeleton`; `all` for everything) and
      prints functions sorted by time. Product CPU only — packed reads and
      PG hydration run in other processes and are excluded;
    * `--dto`: also run `HistoricalEvidence.analyze` (pipeline + DTO build)
      so the DTO construction cost — the family-skeleton representation
      work outside the pipeline timings — becomes visible.

  Requires DATABASE_URL pointing at the corpus Postgres carrying the
  games/moves tier of the packed directory.
  """

  use Mix.Task

  alias Blunderfest.Corpus
  alias Blunderfest.Corpus.Analysis.{Continuation, Families, Features}
  alias Blunderfest.Corpus.Packed
  alias Blunderfest.Corpus.PositionKey
  alias Blunderfest.Corpus.Search.{Candidates, CountMemo, Pipeline}

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

  # The full HE parity set (mix corpus.he_parity), incl. the same-game dup.
  @parity_fens [
    {"Start position", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"},
    {"After 1.e4", "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"},
    {"After 1.d4", "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1"},
    {"F1 (KID tabiya)", "r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1 w - - 0 9"},
    {"A2 (Ruy Lopez)", "r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 b kq - 0 8"},
    {"Najdorf (6.Be3)", "rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 7"},
    {"Rare middlegame", "r1bq1rk1/ppp2ppp/2n2n2/3p4/3P4/2NBPN2/PP3PPP/R1BQ1RK1 w - - 0 8"},
    {"Endgame (cold)", "8/8/2k5/3p4/8/2K1P3/8/8 w - - 0 40"},
    {"Same-game dup", "r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1 b - - 0 9"}
  ]

  @impl Mix.Task
  def run(args) do
    {opts, _rest} =
      OptionParser.parse!(args,
        strict: [
          packed_dir: :string,
          position: :string,
          reps: :integer,
          graph: :boolean,
          eprof: :string,
          cprof: :boolean,
          dto: :boolean,
          snapshot: :string,
          compare: :string
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
      Mix.shell().info("baseline BEAM total: #{mb(:erlang.memory(:total))} MB\n")

      cond do
        opts[:snapshot] ->
          snapshot(opts[:snapshot])

        opts[:compare] ->
          compare(opts[:compare])

        true ->
          reps = Keyword.get(opts, :reps, 1)

          Enum.each(keys, fn {label, key} ->
            runs =
              for i <- 1..reps do
                {us, result} = :timer.tc(fn -> Pipeline.analyze(key, []) end)
                t = result.timings

                dto_line =
                  if opts[:dto] do
                    {dto_us, _} =
                      :timer.tc(fn ->
                        Blunderfest.HistoricalEvidence.analyze(Features.fen(key))
                      end)

                    " · analyze+DTO #{div(dto_us, 1000)}ms"
                  else
                    ""
                  end

                line =
                  "run #{i}: total #{div(us, 1000)}ms (candidates #{t.candidates_ms} / menu #{t.menu_ms} / " <>
                    "evidence #{t.evidence_ms} / pg #{t.pg_ms})#{dto_line}"

                {div(us, 1000), line}
              end

            {totals, lines} = Enum.unzip(runs)

            Mix.shell().info("## #{label}\n" <> Enum.join(lines, "\n"))

            if reps > 1 do
              Mix.shell().info(
                "   min #{Enum.min(totals)} / median #{median(totals)} / p90 #{p(totals, 90)} / max #{Enum.max(totals)}\n"
              )
            end
          end)

          if opts[:graph], do: graph(hd(keys))
          if opts[:eprof], do: eprof(hd(keys), opts[:eprof])
          if opts[:cprof], do: cprof(hd(keys))
      end
    after
      :sys.replace_state(Corpus, fn _ -> corpus_state end)
      Packed.close(backend)
    end
  end

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

  ## Parity snapshot / compare (Phase I). Runs the full HE DTO (timings
  ## stripped) for every parity position and serializes it, so an accepted
  ## optimization can be diffed against the pre-change baseline.

  defp parity_dtos do
    Enum.map(@parity_fens, fn {label, fen} ->
      {:ok, key} = PositionKey.from_fen(fen)
      # Warm once so the comparison is steady-state like the benchmark.
      warm(key)
      {us, result} = :timer.tc(fn -> Blunderfest.HistoricalEvidence.analyze(fen) end)
      {:ok, dto} = result
      {label, key, div(us, 1000), Map.delete(dto, :timings)}
    end)
  end

  defp snapshot(path) do
    dtos =
      Enum.map(parity_dtos(), fn {label, _key, ms, dto} ->
        Mix.shell().info("#{label}: #{ms}ms")
        {label, dto}
      end)

    File.write!(path, :erlang.term_to_binary(dtos))
    Mix.shell().info("\nsnapshot of #{length(dtos)} DTOs → #{path}")
  end

  defp compare(path) do
    base = File.read!(path) |> :erlang.binary_to_term()
    base_map = Map.new(base)

    results =
      Enum.map(parity_dtos(), fn {label, _key, ms, dto} ->
        case Map.fetch(base_map, label) do
          :error ->
            {label, ms, :missing_in_baseline}

          {:ok, ^dto} ->
            {label, ms, :identical}

          {:ok, base_dto} ->
            {label, ms, {:diff, first_diff(base_dto, dto)}}
        end
      end)

    Enum.each(results, fn
      {label, ms, :identical} -> Mix.shell().info("OK    #{label} (#{ms}ms)")
      {label, ms, :missing_in_baseline} -> Mix.shell().info("NEW   #{label} (#{ms}ms)")
      {label, ms, {:diff, path}} -> Mix.shell().info("DIFF  #{label} (#{ms}ms) at #{path}")
    end)

    bad = Enum.reject(results, fn {_l, _ms, s} -> s == :identical end)

    if bad == [] do
      Mix.shell().info("\nPARITY OK — all #{length(results)} positions identical")
    else
      Mix.raise("parity drift in #{length(bad)} position(s)")
    end
  end

  # Returns a dotted path to the first differing field, for diagnosis.
  defp first_diff(a, a), do: nil

  defp first_diff(a, b) when is_map(a) and is_map(b) do
    keys = Enum.uniq(Map.keys(a) ++ Map.keys(b))

    Enum.find_value(keys, fn k ->
      case {Map.fetch(a, k), Map.fetch(b, k)} do
        {:error, _} ->
          "missing key #{inspect(k)} in baseline"

        {_, :error} ->
          "extra key #{inspect(k)}"

        {{:ok, va}, {:ok, vb}} ->
          case first_diff(va, vb) do
            nil -> nil
            sub -> "#{k}.#{sub}"
          end
      end
    end) || "map contents differ"
  end

  defp first_diff(a, b) when is_list(a) and is_list(b) do
    if length(a) != length(b) do
      "list length #{length(a)} vs #{length(b)}"
    else
      a
      |> Enum.zip(b)
      |> Enum.with_index()
      |> Enum.find_value(fn {{x, y}, i} ->
        case first_diff(x, y) do
          nil -> nil
          sub -> "[#{i}].#{sub}"
        end
      end) || "list contents differ"
    end
  end

  defp first_diff(a, b), do: "#{inspect(a)} vs #{inspect(b)}"

  ## The computation graph (Phase D) — one request's derived-work census.

  defp graph({label, key}) do
    family_cfg = Families.default()
    window = family_cfg.window

    gen = Candidates.generate(key, count_memo: CountMemo.new())

    {moves_us, moves_map} =
      :timer.tc(fn ->
        gen.exact_occurrences
        |> Enum.map(fn {gid, _ply} -> gid end)
        |> Blunderfest.Corpus.moves_for()
      end)

    entries =
      Enum.map(gen.exact_occurrences, fn {gid, ply} ->
        {gid, ply, Map.get(moves_map, gid, []) |> Enum.drop(ply)}
      end)

    windows =
      entries
      |> Enum.map(fn {_gid, _ply, sans} -> Enum.take(sans, window) end)
      |> Enum.reject(&(&1 == []))

    distinct = Enum.uniq(windows)
    m = length(distinct)
    pairs = div(m * (m - 1), 2)

    {build_us, menu} = :timer.tc(fn -> Families.build(entries, family_cfg) end)

    member_counts = Enum.map(menu, &length(&1.members))
    total_members = Enum.sum(member_counts)
    cards = length(gen.exact) + length(gen.structural)

    unions = count_threshold_pairs(distinct, family_cfg)

    Mix.shell().info("""

    ## Computation graph (#{label} request)

    exact occurrences fed to the menu        #{length(entries)} (occurrence_limit 2000)
    non-empty #{window}-ply windows                #{length(windows)}
    distinct windows (m)                     #{m}
    pair similarities in clusters            #{pairs}   (m·(m−1)/2)
    pairs reaching threshold (unions)        #{unions}
    Families.build wall time                 #{div(build_us, 1000)} ms
    families                                 #{length(menu)}
    total family members (Σ members)         #{total_members}
    largest family (members)                 #{Enum.max(member_counts, fn -> 0 end)}
    cards emitted                            #{cards} (#{length(gen.exact)} exact + #{length(gen.structural)} structural)
    moves_for batch (PG, excluded)           #{div(moves_us, 1000)} ms

    derived per-card work (× #{cards} cards):
      Families.membership similarities       #{total_members} / card (every family member re-represented + jaccard)
      Skeleton.membership similarities       #{2 * total_members} / card (both sides × every member)
      Skeleton member representations        #{2 * total_members} / card (regex tokenization, recomputed)
      Differences.positional + continuation    1 + 1 / card

    DTO construction (outside pipeline timings):
      Skeleton.represent per menu member     #{total_members} (family_dto white/black actions)
    """)
  end

  # The exact pair predicate of Families.clusters, counting the pairs that
  # reach the threshold (the union calls). Same representations, same metric,
  # same pair set — the default cfg is :multiset, which clusters/3 evaluates
  # as Continuation.represent(seq, metric, :w) + jaccard.
  defp count_threshold_pairs(distinct, cfg) do
    reps =
      distinct |> Enum.map(&Continuation.represent(&1, cfg.metric, :w)) |> List.to_tuple()

    n = tuple_size(reps)

    for i <- 0..max(n - 2, -1)//1,
        j <- (i + 1)..(n - 1)//1,
        Continuation.similarity(elem(reps, i), elem(reps, j), cfg.metric) >= cfg.threshold,
        reduce: 0 do
      acc -> acc + 1
    end
  end

  ## Profiler hooks (Phase C). Product CPU only: packed reads and PG
  ## hydration run in the Corpus/Postgrex processes, outside the profiled
  ## process, so they do not pollute the attribution.
  ##
  ## OTP's `tools` ebin is not on Mix's code path in this environment —
  ## load it explicitly (the modules exist in the distribution).

  defp ensure_tools! do
    unless Code.ensure_loaded?(:eprof) do
      root = to_string(:code.root_dir())

      case Path.wildcard(Path.join([root, "lib", "tools-*", "ebin"])) do
        [path | _] -> Code.prepend_path(path)
        [] -> Mix.raise("OTP :tools not found — profiler unavailable")
      end
    end

    Code.ensure_loaded?(:eprof) || Mix.raise("cannot load :eprof")
  end

  @eprof_modules %{
    "Continuation" => Blunderfest.Corpus.Analysis.Continuation,
    "Families" => Blunderfest.Corpus.Analysis.Families,
    "Skeleton" => Blunderfest.Corpus.Analysis.Skeleton,
    "Differences" => Blunderfest.Corpus.Analysis.Differences,
    "Features" => Blunderfest.Corpus.Analysis.Features,
    "Route" => Blunderfest.Corpus.Analysis.Route,
    "Pipeline" => Blunderfest.Corpus.Search.Pipeline,
    "Enum" => Enum,
    "Map" => Map,
    "MapSet" => MapSet,
    "String" => String
  }

  defp eprof({_label, key}, spec) do
    ensure_tools!()

    patterns =
      case spec do
        "all" ->
          [{:_, :_, :_}]

        list ->
          list
          |> String.split(",", trim: true)
          |> Enum.map(fn name ->
            case Map.fetch(@eprof_modules, name) do
              {:ok, mod} ->
                {mod, :_, :_}

              :error ->
                Mix.raise(
                  "unknown eprof module #{name} — one of: #{Enum.join(Map.keys(@eprof_modules), ", ")}"
                )
            end
          end)
      end

    Enum.each(patterns, fn pattern ->
      Mix.shell().info("\n## :eprof — tracing #{inspect(pattern)}")

      apply(:eprof, :start, [])

      {:ok, result} =
        apply(:eprof, :profile, [[], fn -> Pipeline.analyze(key, []) end, pattern])

      Mix.shell().info("profiled run timings: #{inspect(result.timings)}")
      apply(:eprof, :analyze, [:total, [sort: :time]])
      apply(:eprof, :stop, [])
    end)

    :ok
  end

  defp cprof({_label, key}) do
    ensure_tools!()
    Mix.shell().info("\n## :cprof — one pipeline run")

    apply(:cprof, :start, [])
    _ = Pipeline.analyze(key, [])
    apply(:cprof, :pause, [])

    for mod <- [
          Blunderfest.Corpus.Analysis.Continuation,
          Blunderfest.Corpus.Analysis.Families,
          Blunderfest.Corpus.Analysis.Skeleton,
          Blunderfest.Corpus.Analysis.Differences,
          Blunderfest.Corpus.Analysis.Features,
          Blunderfest.Corpus.Analysis.Route,
          Blunderfest.Corpus.Search.Pipeline,
          Blunderfest.Corpus.Search.Candidates,
          Blunderfest.Corpus,
          Enum,
          Map,
          MapSet,
          Regex,
          String
        ] do
      {_mod, total, list} = apply(:cprof, :analyse, [mod])

      lines =
        Enum.map(list, fn {{_m, f, a}, c} ->
          String.pad_trailing("#{f}/#{a}", 34) <> Integer.to_string(c)
        end)

      Mix.shell().info("\n--- #{inspect(mod)} (#{total} calls) ---\n" <> Enum.join(lines, "\n"))
    end

    apply(:cprof, :stop, [])
    :ok
  end

  ## Helpers

  defp median(list) do
    sorted = Enum.sort(list)
    Enum.at(sorted, div(length(sorted), 2))
  end

  defp p(list, pct) do
    sorted = Enum.sort(list)
    n = length(sorted)
    Enum.at(sorted, min(div(n * pct, 100), n - 1))
  end

  defp mb(bytes), do: Float.round(bytes / 1024 / 1024, 1)
end
