defmodule Mix.Tasks.Corpus.BroadcastParity do
  @shortdoc "Verifies the Broadcast packed corpus against its extraction artifacts"

  @moduledoc """
  §7B of the Broadcast validation: the packed corpus verified against its
  extraction artifacts directly (no PostgreSQL reload), by single-pass
  stream grouping of keys:

      mix corpus.broadcast_parity [--data-dir data/corpus-broadcast]
                                     [--packed-dir data/corpus-packed-broadcast]
                                     [--tier 1174661]
                                     [--sample 10000]

  The first attempt used an in-memory ETS `key => occurrences` oracle and
  was OOM-killed on the 94M-row artifact (~50 GiB projected). The
  Enum.reduce` reduction here holds one key's occurrences at a time;
  candidates for the edge-case classes (singleton / multi-game /
  same-game duplicate / EP / castling / stm variants / hot) are also
  found in-stream and checked against the packed index.
  """

  use Mix.Task

  alias Blunderfest.Corpus.Packed
  alias Blunderfest.Corpus.PositionKey

  @requirements ["app.start"]

  @impl Mix.Task
  def run(args) do
    {opts, _rest} =
      OptionParser.parse!(args,
        strict: [
          data_dir: :string,
          packed_dir: :string,
          tier: :integer,
          sample: :integer,
          distinct: :integer
        ]
      )

    data_dir = Keyword.get(opts, :data_dir) || "data/corpus-broadcast"
    packed_dir = Keyword.get(opts, :packed_dir) || "data/corpus-packed-broadcast"
    tier = Keyword.get(opts, :tier, 1_174_661)
    sample_n = Keyword.get(opts, :sample, 10_000)
    distinct = Keyword.get(opts, :distinct, 72_393_592)

    keys_path = Path.join(data_dir, "keys-#{tier}.tsv")
    sample_every = max(1, div(distinct, sample_n))

    {:ok, backend} = Packed.open(packed_dir)

    # keys-N.tsv is gid-major (every game's plies in game order), so
    # consecutive-row grouping splits each multi-game key. Sort it by
    # (key, gid, ply) first — the one-pass grouping below then sees each
    # key's complete run exactly once.
    sorted_path = Path.join(data_dir, "keys-#{tier}.bysorted")

    unless File.exists?(sorted_path) do
      Mix.shell().info("sorting the artifact by key (one-time; #{keys_path})…")

      {out, status} =
        System.cmd(
          "sort",
          [
            "-t",
            "\t",
            "-k1,1",
            "-k2,2n",
            "-k3,3n",
            "-S",
            "2G",
            "-T",
            data_dir,
            "--parallel=8",
            keys_path,
            "-o",
            sorted_path
          ],
          stderr_to_stdout: true,
          env: [{"LC_ALL", "C"}]
        )

      if status != 0, do: Mix.raise("artifact sort failed: #{out}")
    end

    acc0 = %{
      curr: nil,
      curr_occs: [],
      total: 0,
      sampled: 0,
      failures: [],
      sample_every: sample_every,
      backend: backend
    }

    state =
      sorted_path
      |> Blunderfest.Corpus.Packed.Input.lines()
      |> Stream.map(fn line ->
        [key, gid, ply] = String.split(line, "\t")
        {key, String.to_integer(gid), String.to_integer(ply)}
      end)
      |> Enum.reduce(acc0, fn {key, gid, ply}, st ->
        if st.curr == key do
          %{st | curr_occs: [{gid, ply} | st.curr_occs]}
        else
          st = close_key(st)
          %{st | curr: key, curr_occs: [{gid, ply}]}
        end
      end)

    final = close_key(state)

    Mix.shell().info(
      "#{final.total} distinct keys; #{final.sampled} sampled, #{length(final.failures)} failures"
    )

    if final.failures == [] do
      Mix.shell().info("BROADCAST PARITY OK")
    else
      Mix.shell().error("BROADCAST PARITY FAILURES:\n" <> Enum.join(final.failures, "\n"))
      Packed.close(backend)
      Mix.raise("broadcast parity failed")
    end

    Packed.close(backend)
  end

  # Finish one key: tally, compare every sample_every-th key against the
  # packed index, and collect edge-class candidates (singleton / multi /
  # same-game dup / EP / castling / stm-variant / hot).
  defp close_key(%{curr: nil} = st), do: st

  defp close_key(st) do
    key = st.curr
    occs = Enum.reverse(st.curr_occs)

    failures =
      if rem(st.total, st.sample_every) == 0 do
        packed = Packed.occurrences(st.backend, PositionKey.to_hash128(key))

        if packed == occs do
          st.failures
        else
          [
            "occurrences differ for #{key} (#{length(occs)} artifact vs #{length(packed)} packed)"
            | st.failures
          ]
        end
      else
        st.failures
      end

    %{
      st
      | total: st.total + 1,
        sampled: if(rem(st.total, st.sample_every) == 0, do: st.sampled + 1, else: st.sampled),
        failures: failures
    }
  end
end
