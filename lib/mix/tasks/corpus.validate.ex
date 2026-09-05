defmodule Mix.Tasks.Corpus.Validate do
  @shortdoc "Validates a packed corpus directory (sizes, counts, checksums)"

  @moduledoc """
  Opens a packed directory the same way the backend does, and additionally
  verifies every file's recorded SHA-256 (Spike 08, §20).

      mix corpus.validate [--packed-dir data/corpus-packed] [--sample 32]

  Fails (exit non-zero) when the directory is corrupt or partial; the
  backend refuses to open it anyway, but the error here names the exact
  mismatch — build validation that never publishes a broken segment.

  Format-v2 segments additionally get the sampled run verification
  (Spike 09 Phase 2): `--sample` evenly spread position headers per segment
  have their stored statistics (`occurrence_count`, `game_count`,
  `occ_run_offset`) recomputed from occ.bin — run span, boundaries and
  distinct-game count must reproduce exactly.
  """

  use Mix.Task

  alias Blunderfest.Corpus.Packed
  alias Blunderfest.Corpus.Packed.Segment

  @requirements ["app.start"]

  @impl Mix.Task
  def run(args) do
    {opts, _rest} =
      OptionParser.parse!(args, strict: [packed_dir: :string, sample: :integer])

    config = Application.get_env(:blunderfest, Blunderfest.Corpus, [])
    packed_dir = Keyword.get(opts, :packed_dir, config[:packed_dir] || "data/corpus-packed")
    sample = Keyword.get(opts, :sample, 32)

    case Packed.open(packed_dir, verify_checksums: true) do
      {:ok, backend} ->
        counts = Packed.counts(backend)

        Enum.each(backend.segments, fn seg ->
          if seg.pos_version == 2 do
            case Segment.verify_sampled_runs(seg, sample) do
              :ok ->
                :ok

              {:error, reason} ->
                Mix.raise(
                  "v2 stats verification failed for segment #{seg.id}: #{inspect(reason)}"
                )
            end
          end
        end)

        Packed.close(backend)

        versions = backend.segments |> Enum.map(&"pos v#{&1.pos_version}") |> Enum.join(", ")

        Mix.shell().info(
          "validated #{packed_dir}: #{counts.games} games, #{counts.occurrences} occurrences, #{counts.positions} positions (checksums verified#{v2_note(backend, sample)}) [#{versions}]"
        )

      {:error, reason} ->
        Mix.raise("validation failed for #{packed_dir}: #{inspect(reason)}")
    end
  end

  defp v2_note(backend, sample) do
    if Enum.any?(backend.segments, &(&1.pos_version == 2)) do
      ", v2 stats verified on #{sample} sampled positions/segment"
    else
      ""
    end
  end
end
