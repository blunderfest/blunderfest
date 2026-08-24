defmodule Mix.Tasks.Corpus.Extract do
  @shortdoc "Extracts the derived corpus artifacts (occ/games/moves/keys) from a PGN file"

  @moduledoc """
  Runs `Blunderfest.Corpus.Extraction` over a Lichess database PGN:

      mix corpus.extract --games 100000 --corpus path/to/corpus.pgn --out-dir data/corpus

  Options:

    * `--games N` — how many games to extract (required)
    * `--corpus PATH` — the PGN file (default: `data/corpus/corpus.pgn`)
    * `--out-dir PATH` — artifact directory (default: `data/corpus`)

  Idempotent in effect: it re-derives the artifacts from the PGN, which is
  exactly the rebuild path ADR-0026 keeps available.
  """

  use Mix.Task

  @impl Mix.Task
  def run(args) do
    {opts, _rest} =
      OptionParser.parse!(args, strict: [games: :integer, corpus: :string, out_dir: :string])

    games = opts[:games] || Mix.raise("--games is required")
    corpus = Keyword.get(opts, :corpus, "data/corpus/corpus.pgn")
    out_dir = Keyword.get(opts, :out_dir, "data/corpus")

    unless File.exists?(corpus) do
      Mix.raise("corpus PGN not found at #{corpus} — pass --corpus PATH")
    end

    result =
      Blunderfest.Corpus.Extraction.run(corpus, games: games, out_dir: out_dir)

    Mix.shell().info("""
    Extracted #{result.stats.games} games, #{result.stats.plies} plies \
    (#{result.stats.games_failed} failed) in #{div(result.wall_ms, 1000)}s

      occ:   #{result.paths.occ}
      games: #{result.paths.games}
      moves: #{result.paths.moves}
      keys:  #{result.paths.keys}
      stats: #{result.paths.stats}
    """)
  end
end
