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

  For format-v2 directories (Spike 09 Phase 2) every sampled key
  additionally re-counts the run straight from the artifact stream and
  compares it to the packed position header's stored statistics
  (`occurrence_count`, `game_count`) — the streamed re-count parity of the
  migration plan, with no PostgreSQL reload.
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

    v2 = Enum.all?(backend.segments, &(&1.pos_version == 2))

    if v2 do
      Mix.shell().info("format v2 directory — sampled keys also re-count header statistics")
    end

    acc0 = %{
      curr: nil,
      curr_occs: [],
      total: 0,
      sampled: 0,
      failures: [],
      sample_every: sample_every,
      backend: backend,
      v2: v2
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
    sampled? = rem(st.total, st.sample_every) == 0

    failures =
      if sampled? do
        hash = PositionKey.to_hash128(key)
        packed = Packed.occurrences(st.backend, hash)

        failures =
          if packed == occs do
            st.failures
          else
            [
              "occurrences differ for #{key} (#{length(occs)} artifact vs #{length(packed)} packed)"
              | st.failures
            ]
          end

        compare_v2_stats(failures, st, key, hash, occs)
      else
        st.failures
      end

    %{
      st
      | total: st.total + 1,
        sampled: if(sampled?, do: st.sampled + 1, else: st.sampled),
        failures: failures
    }
  end

  # The artifact run itself is the oracle for the stored v2 statistics:
  # occurrence_count is the run length, game_count the distinct gids in it.
  defp compare_v2_stats(failures, %{v2: false}, _key, _hash, _occs), do: failures

  defp compare_v2_stats(failures, st, key, hash, occs) do
    expected_games = occs |> Enum.map(&elem(&1, 0)) |> Enum.uniq() |> length()

    case Packed.position_stats(st.backend, hash) do
      {:ok, %{occurrences: occ_count, games: game_count}} ->
        cond do
          occ_count != length(occs) ->
            [
              "v2 occurrence_count differs for #{key} (artifact #{length(occs)} vs header #{occ_count})"
              | failures
            ]

          game_count != expected_games ->
            [
              "v2 game_count differs for #{key} (artifact #{expected_games} vs header #{game_count})"
              | failures
            ]

          true ->
            failures
        end

      {:error, :format_v1} ->
        failures
    end
  end
end
