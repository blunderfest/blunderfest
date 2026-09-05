defmodule Mix.Tasks.Corpus.HeParity do
  @shortdoc "Historical Evidence parity: PG vs packed backend on the reference positions"

  @moduledoc """
  The Spike 08 product-level parity check (brief §9/§13): the full
  Historical Evidence pipeline must produce identical observable results
  against both occurrence backends.

      mix corpus.he_parity [--packed-dir data/corpus-packed]

  Reference positions (brief §9): F1 King's Indian tabiya, A2 Ruy López
  decision point, Najdorf, a rare middlegame, a cold/endgame position, and
  a same-game duplicate position — extended (Spike 09 §2) with the three
  hot opening positions the original set lacked: the start position and
  after 1.e4 / 1.d4, the corpus' hottest keys and the exact class the
  original parity pass never covered.

  For each: the pipeline runs twice (once with the facade's occurrence
  backend as Postgres, once packed) and the resulting DTOs are compared
  field by field. Timings are excluded from comparison but recorded for the
  end-to-end latency numbers.

  With `--vs-dir`, the comparison is packed-vs-packed instead of
  PG-vs-packed (Phase 3: the broadcast v1 ↔ v2 format parity, where no PG
  occurrence oracle exists at that scale):

      mix corpus.he_parity --packed-dir data/corpus-packed-broadcast \
        --vs-dir data/corpus-packed-broadcast-v2

  The known one-key book-stream difference (v2 carries the final book key
  the v1 `Stream.transform/4` bug dropped) does not touch the reference
  positions, so the set must still compare identical.

  Requires DATABASE_URL pointing at the loaded corpus Postgres (the
  games/moves tier matching the packed directories).
  """

  use Mix.Task

  alias Blunderfest.Corpus
  alias Blunderfest.Corpus.Packed
  alias Blunderfest.Corpus.PositionKey
  alias Blunderfest.Corpus.Search.Pipeline

  @requirements ["app.start"]

  @fens [
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
    {opts, _rest} = OptionParser.parse!(args, strict: [packed_dir: :string, vs_dir: :string])

    config = Application.get_env(:blunderfest, Blunderfest.Corpus, [])
    packed_dir = Keyword.get(opts, :packed_dir, config[:packed_dir] || "data/corpus-packed")
    vs_dir = Keyword.get(opts, :vs_dir)

    db = config[:db] || Mix.raise("no corpus database configured — set DATABASE_URL")
    {:ok, conn} = Postgrex.start_link(Keyword.merge([pool_size: 4, timeout: :infinity], db))

    {:ok, backend} = Packed.open(packed_dir)

    # Two packed directories → packed-vs-packed (format parity); otherwise
    # Postgres is the oracle backend on the left side.
    vs =
      if vs_dir do
        {:ok, other} = Packed.open(vs_dir)
        {:packed, other, Path.basename(vs_dir)}
      else
        {:postgres, nil, "PG"}
      end

    Mix.shell().info(
      "running Historical Evidence (#{Path.basename(packed_dir)} vs #{elem(vs, 2)})…\n"
    )

    results =
      Enum.map(@fens, fn {label, fen} ->
        {:ok, key} = PositionKey.from_fen(fen)

        left = run_backend(conn, :packed, backend, key)
        right = run_backend(conn, elem(vs, 0), elem(vs, 1), key)

        same = left.result == right.result

        Mix.shell().info(
          "#{if same, do: "OK  ", else: "DIFF"} #{label}: #{elem(vs, 2)} #{right.ms}ms vs packed #{left.ms}ms"
        )

        unless same do
          Mix.shell().info(
            "  ref counts: #{elem(vs, 2)} #{inspect(right.result.reference.historical)} vs packed #{inspect(left.result.reference.historical)}"
          )

          Mix.shell().info(
            "  next_moves: #{elem(vs, 2)} #{inspect(right.result.reference.next_moves)} vs packed #{inspect(left.result.reference.next_moves)}"
          )

          Mix.shell().info(
            "  candidates: #{elem(vs, 2)} #{length(right.result.candidates)} vs packed #{length(left.result.candidates)}"
          )
        end

        {label, same, %{left_ms: left.ms, right_ms: right.ms}}
      end)

    Packed.close(backend)
    if elem(vs, 1), do: Packed.close(elem(vs, 1))

    if Enum.all?(results, fn {_, same, _} -> same end) do
      Mix.shell().info("\nHE PARITY OK — all #{length(results)} reference positions identical")
    else
      Mix.raise("HE parity failed")
    end
  end

  ## One pipeline run against one occurrence store

  # `packed` nil selects the Postgres occurrence tables; a backend struct
  # selects that packed directory. Games/moves always come from `conn`.
  defp run_backend(conn, backend_kind, packed, key) do
    # Swap the facade's occurrence backend for this run (the process is
    # single and app-booted; restore it after).
    corpus_state = :sys.get_state(Corpus)

    :sys.replace_state(Corpus, fn _ ->
      %{pool: conn, packed: if(backend_kind == :packed, do: packed, else: nil)}
    end)

    {us, result} =
      :timer.tc(fn ->
        Pipeline.analyze(key, []) |> Map.delete(:timings)
      end)

    :sys.replace_state(Corpus, fn _ -> corpus_state end)

    %{ms: div(us, 1000), result: result}
  end
end
