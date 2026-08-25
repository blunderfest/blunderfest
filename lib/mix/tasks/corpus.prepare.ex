defmodule Mix.Tasks.Corpus.Prepare do
  @shortdoc "Precomputes the pawn-hash transform for keys-N.tsv (production load path)"

  @moduledoc """
  Reads `keys-N.tsv` and writes `positions-N.tsv`
  (`key \\t pawn_hash \\t gid \\t ply`), moving the pawn-hash transform off
  the loading machine. The machine-side load then becomes pure COPY —
  which survives the shared-vCPU throttling that stalls the hashing
  stream mid-COPY (a production-load failure).

      mix corpus.prepare [--data-dir data/corpus] [--tier 100000]
  """

  use Mix.Task

  @impl Mix.Task
  def run(args) do
    {opts, _rest} =
      OptionParser.parse!(args, strict: [data_dir: :string, tier: :integer])

    config = Application.get_env(:blunderfest, Blunderfest.Corpus, [])
    data_dir = Keyword.get(opts, :data_dir, config[:data_dir] || "data/corpus")
    tier = Keyword.get(opts, :tier, config[:tier] || 100_000)

    source = Path.join(data_dir, "keys-#{tier}.tsv")
    target = Path.join(data_dir, "positions-#{tier}.tsv")

    unless File.exists?(source) do
      Mix.raise("keys artifact not found at #{source} — run mix corpus.extract first")
    end

    started = System.monotonic_time(:millisecond)

    rows =
      source
      |> File.stream!(:line)
      |> Stream.map(fn line ->
        [key, gid, ply] = line |> String.trim_trailing("\n") |> String.split("\t")

        pawn_hash =
          key
          |> Blunderfest.Corpus.Analysis.Features.pawn_hash()
          |> Integer.to_string()

        Enum.join([key, pawn_hash, gid, ply], "\t") <> "\n"
      end)
      |> Stream.chunk_every(10_000)
      |> Task.async_stream(
        fn chunk -> IO.iodata_to_binary(chunk) end,
        ordered: true,
        timeout: :infinity,
        max_concurrency: System.schedulers_online()
      )
      |> Enum.reduce(0, fn {:ok, bytes}, acc ->
        File.write!(target, bytes, [:append])
        acc + div(byte_size(bytes), 30)
      end)

    wall_s = div(System.monotonic_time(:millisecond) - started, 1000)

    Mix.shell().info("Prepared ~#{rows} rows -> #{target} in #{wall_s}s")
  end
end
