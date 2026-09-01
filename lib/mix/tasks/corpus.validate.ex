defmodule Mix.Tasks.Corpus.Validate do
  @shortdoc "Validates a packed corpus directory (sizes, counts, checksums)"

  @moduledoc """
  Opens a packed directory the same way the backend does, and additionally
  verifies every file's recorded SHA-256 (Spike 08, §20).

      mix corpus.validate [--packed-dir data/corpus-packed]

  Fails (exit non-zero) when the directory is corrupt or partial; the
  backend refuses to open it anyway, but the error here names the exact
  mismatch — build validation that never publishes a broken segment.
  """

  use Mix.Task

  alias Blunderfest.Corpus.Packed

  @requirements ["app.start"]

  @impl Mix.Task
  def run(args) do
    {opts, _rest} = OptionParser.parse!(args, strict: [packed_dir: :string])

    config = Application.get_env(:blunderfest, Blunderfest.Corpus, [])
    packed_dir = Keyword.get(opts, :packed_dir, config[:packed_dir] || "data/corpus-packed")

    case Packed.open(packed_dir, verify_checksums: true) do
      {:ok, backend} ->
        counts = Packed.counts(backend)
        Packed.close(backend)

        Mix.shell().info(
          "validated #{packed_dir}: #{counts.games} games, #{counts.occurrences} occurrences, #{counts.positions} positions (checksums verified)"
        )

      {:error, reason} ->
        Mix.raise("validation failed for #{packed_dir}: #{inspect(reason)}")
    end
  end
end
