defmodule Mix.Tasks.Corpus.He18 do
  @shortdoc "Historical Evidence validation against the Broadcast packed corpus"

  @moduledoc """
  §8 of the Broadcast validation: the full Historical Evidence pipeline
  against the packed Broadcast corpus.

  Plumbing: rename the live 100k games/moves tables to corpus_games_100k /
  corpus_moves_100k, and promote corpus_broadcast_games /
  corpus_broadcast_moves to corpus_games / corpus_moves. Then the facade
  reads broadcast games/moves — but the `:book` route still hits PG's
  aggregated SQL against the 100k occurrence table (wrong scale), so the
  task substitutes `Pipeline.analyze`'s next-moves with
  `Book.for_key_packed/3` — the same aggregate the future `:packed` mode
  will run.

      mix corpus.he18 [--packed-dir data/corpus-packed-broadcast]

  A swapped-in corpus lasts until `corpus.he100k` restores the 100k
  tables, in the same directory.
  """

  use Mix.Task

  alias Blunderfest.Corpus
  alias Blunderfest.Corpus.{Book, Packed, PositionKey}
  alias Blunderfest.Corpus.Search.Pipeline

  @requirements ["app.start"]

  @fens [
    {"F1 (KID tabiya)", "r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1 w - - 0 9"},
    {"A2 (Ruy Lopez)", "r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 b kq - 0 8"},
    {"Najdorf (6.Be3)", "rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 7"},
    {"Rare middlegame", "r1bq1rk1/ppp2ppp/2n2n2/3p4/3P4/2NBPN2/PP3PPP/R1BQ1RK1 w - - 0 8"},
    {"Endgame (cold)", "8/8/2k5/3p4/8/2K1P3/8/8 w - - 0 40"},
    {"Same-game dup", "r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1 b - - 0 9"}
  ]

  @impl Mix.Task
  def run(args) do
    {opts, _rest} = OptionParser.parse!(args, strict: [packed_dir: :string])
    packed_dir = Keyword.get(opts, :packed_dir, "data/corpus-packed-broadcast")

    config = Application.get_env(:blunderfest, Blunderfest.Corpus, [])
    db = config[:db] || Mix.raise("DATABASE_URL required")

    {:ok, conn} = Postgrex.start_link(Keyword.merge([pool_size: 4, timeout: :infinity], db))

    # Promote the broadcast games/moves tables into the facade's table
    # names (so Occurrences.game/moves/moves_for/resolve find broadcast gids).
    promote_broadcast(conn)

    {:ok, backend} = Packed.open(packed_dir)

    corpus_state = :sys.get_state(Corpus)
    :sys.replace_state(Corpus, fn _ -> %{pool: conn, packed: backend} end)

    Mix.shell().info("running HE against the Broadcast corpus…\n")

    Enum.each(@fens, fn {label, fen} ->
      {:ok, key} = PositionKey.from_fen(fen)

      {us, result} = :timer.tc(fn -> Pipeline.analyze(key, []) end)

      # The `:book` SQL route aggregates against the 100k occurrence table;
      # recompute with the packed-mode aggregate instead.
      packed_next = Book.for_key_packed(backend, conn, key)
      result = put_in(result[:reference][:next_moves], packed_next)

      Mix.shell().info(
        "#{label}: #{result.reference.historical.occurrences} occurrences / " <>
          "#{result.reference.historical.games} games / candidates #{length(result.candidates)} / " <>
          "next #{Enum.map_join(result.reference.next_moves, ", ", &"#{&1.move}(#{&1.games})")} " <>
          "in #{div(us, 1000)}ms"
      )
    end)

    :sys.replace_state(Corpus, fn _ -> corpus_state end)
    restore_100k(conn)
    Packed.close(backend)

    Mix.shell().info("\nHE on Broadcast completed (100k tables restored).")
  end

  ## Swap <-> restore

  defp promote_broadcast(conn) do
    sql = """
      DROP TABLE IF EXISTS corpus_games_100k;
      DROP TABLE IF EXISTS corpus_moves_100k;
      ALTER TABLE corpus_games RENAME TO corpus_games_100k;
      ALTER TABLE corpus_moves RENAME TO corpus_moves_100k;
      ALTER TABLE corpus_broadcast_games RENAME TO corpus_games;
      ALTER TABLE corpus_broadcast_moves RENAME TO corpus_moves;
    """

    Postgrex.query!(conn, sql, [])
  rescue
    _ -> nil
  end

  defp restore_100k(conn) do
    sql = """
      ALTER TABLE corpus_games RENAME TO corpus_broadcast_games;
      ALTER TABLE corpus_moves RENAME TO corpus_broadcast_moves;
      ALTER TABLE corpus_games_100k RENAME TO corpus_games;
      ALTER TABLE corpus_moves_100k RENAME TO corpus_moves;
    """

    Postgrex.query!(conn, sql, [])
  rescue
    _ -> nil
  end
end
