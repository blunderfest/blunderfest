defmodule Mix.Tasks.Corpus.Load do
  @shortdoc "Rebuilds the corpus tables in Postgres from the extraction artifacts"

  @moduledoc """
  Drops and reloads the corpus tables via `Blunderfest.Corpus` (ADR-0026's
  rebuild path):

      mix corpus.load [--data-dir data/corpus] [--tier 100000]

  Defaults come from the application config. Requires a configured corpus
  database (the `DATABASE_URL` secret in prod, the docker Postgres locally).
  """

  use Mix.Task

  @requirements ["app.start"]

  @impl Mix.Task
  def run(args) do
    {opts, _rest} =
      OptionParser.parse!(args, strict: [data_dir: :string, tier: :integer])

    config = Application.fetch_env!(:blunderfest, Blunderfest.Corpus)
    data_dir = Keyword.get(opts, :data_dir, config[:data_dir])
    tier = Keyword.get(opts, :tier, config[:tier])

    started = System.monotonic_time(:millisecond)

    case Blunderfest.Corpus.rebuild(data_dir, tier) do
      {:error, :not_configured} ->
        Mix.raise("no corpus database configured — export DATABASE_URL (see docs/operations.md)")

      counts ->
        wall_s = div(System.monotonic_time(:millisecond) - started, 1000)

        Mix.shell().info("""
        Loaded tier #{tier} from #{data_dir} in #{wall_s}s:

          positions:   #{counts.positions}
          occurrences: #{counts.occurrences}
          games:       #{counts.games}
          moves:       #{counts.moves}
        """)
    end
  end
end
