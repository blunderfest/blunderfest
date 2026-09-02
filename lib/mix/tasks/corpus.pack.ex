defmodule Mix.Tasks.Corpus.Pack do
  @shortdoc "Builds the packed binary occurrence index from the extraction artifacts"

  @moduledoc """
  Builds packed segments (Spike 08) from the extraction artifacts — the
  bulk-import path of brief §15, minus the PGN parse (already done by
  `mix corpus.extract`):

      mix corpus.pack [--data-dir data/corpus] [--tier 100000]
                      [--out data/corpus-packed] [--segments 1]

  Inputs are the row-aligned artifacts (`occ-N.tsv` hash/gid/ply,
  `positions-N.tsv` key/pawn_hash/gid/ply); the task asserts the alignment
  while zipping. Rows are combined, externally sorted by `(hash, gid, ply)`,
  split into `--segments` gid ranges, and packed per segment; the manifest
  is written last (a directory without a manifest never opens — atomic
  publication, §18).

  Postgres is not involved: the corpus tables are built from the same
  artifacts, and the packed index is verified against them by
  `mix corpus.parity`.
  """

  use Mix.Task

  alias Blunderfest.Corpus.Packed.{Builder, Input, Manifest}

  @requirements ["app.start"]

  @impl Mix.Task
  def run(args) do
    {opts, _rest} =
      OptionParser.parse!(args,
        strict: [
          data_dir: :string,
          out: :string,
          tier: :integer,
          segments: :integer,
          resume: :string
        ]
      )

    config = Application.get_env(:blunderfest, Blunderfest.Corpus, [])
    data_dir = Keyword.get(opts, :data_dir, config[:data_dir] || "data/corpus")
    tier = Keyword.get(opts, :tier, config[:tier] || 100_000)
    out = Keyword.get(opts, :out, config[:packed_dir] || "data/corpus-packed")
    n_segments = Keyword.get(opts, :segments, 1)

    occ_path = Path.join(data_dir, "occ-#{tier}.tsv")
    positions_path = Path.join(data_dir, "positions-#{tier}.tsv")
    games_path = Path.join(data_dir, "games-#{tier}.tsv")
    moves_path = Path.join(data_dir, "moves-#{tier}.tsv")

    for path <- [occ_path, positions_path, games_path, moves_path] do
      unless File.exists?(path) do
        Mix.raise("artifact not found: #{path} — run mix corpus.extract / corpus.prepare first")
      end
    end

    started = System.monotonic_time(:millisecond)

    # --resume <dir>: reuse an existing build dir's intermediates (a failed
    # late phase shouldn't redo the 15-min combine). The build dir must not
    # live *inside* the publish target — the "rename existing output aside"
    # step would move the build with it.
    resume_dir = Keyword.get(opts, :resume)

    {tmp, _combined, _bookraw, sorted, bookraw_sorted, games_count} =
      if resume_dir != nil do
        tmp = resume_dir
        combined = Path.join(tmp, "combined.tsv")
        bookraw = Path.join(tmp, "bookraw.tsv")
        sorted = Path.join(tmp, "sorted.tsv")
        bookraw_sorted = Path.join(tmp, "bookraw-sorted.tsv")
        games_count = line_count(Path.join(data_dir, "games-#{tier}.tsv"))

        # Rebuild any missing intermediates; the others are reused.
        if File.exists?(combined) and File.exists?(bookraw) do
          Mix.shell().info("resuming #{tmp} — combined/bookraw exist, skipping combine")
        else
          combine!(occ_path, positions_path, moves_path, games_path, combined, bookraw)
        end

        sorted =
          if File.exists?(sorted) and File.stat!(sorted).size > 0 do
            sorted
          else
            sort!(combined, sorted)
            sorted
          end

        bookraw_sorted =
          if File.exists?(bookraw_sorted) and File.stat!(bookraw_sorted).size > 0 do
            bookraw_sorted
          else
            sort_bookraw!(bookraw, bookraw_sorted, tmp)
            bookraw_sorted
          end

        {tmp, combined, bookraw, sorted, bookraw_sorted, games_count}
      else
        tmp = "#{out}.build-#{System.unique_integer([:positive])}"
        File.rm_rf!(tmp)
        File.mkdir_p!(tmp)

        combined = Path.join(tmp, "combined.tsv")
        bookraw = Path.join(tmp, "bookraw.tsv")

        games_count =
          combine!(occ_path, positions_path, moves_path, games_path, combined, bookraw)

        sorted = Path.join(tmp, "sorted.tsv")
        sort!(combined, sorted)

        bookraw_sorted = Path.join(tmp, "bookraw-sorted.tsv")
        sort_bookraw!(bookraw, bookraw_sorted, tmp)

        {tmp, combined, bookraw, sorted, bookraw_sorted, games_count}
      end

    # 3. Split into gid-range segments (still hash-sorted within each), then
    #    pack each segment and write the manifest last.
    boundaries = gid_boundaries(games_count, n_segments)
    splits = split_segments(sorted, tmp, boundaries, games_count)

    entries =
      splits
      |> Enum.with_index(1)
      |> Enum.map(fn {{path, seg_games}, i} ->
        id = "seg-#{String.pad_leading(Integer.to_string(i), 6, "0")}"

        Builder.build!(
          tmp,
          id,
          occurrence_stream(path),
          position_stream(path),
          book_stream(
            bookraw_sorted,
            elem(Enum.at(boundaries, i - 1), 0),
            elem(Enum.at(boundaries, i - 1), 1)
          ),
          seg_games
        )
      end)

    Manifest.write!(tmp, entries)

    # Atomic publication: swap the built directory into place as one rename.
    publish!(tmp, out)

    wall_s = div(System.monotonic_time(:millisecond) - started, 1000)

    Mix.shell().info("""
    Packed tier #{tier} -> #{out} in #{wall_s}s (#{n_segments} segment#{if n_segments == 1, do: "", else: "s"}):

    #{Enum.map_join(entries, "\n", fn e -> "  #{e.id}: #{e.games} games, #{e.occurrences} occurrences, #{e.positions} positions" end)}
    """)
  end

  ## Zip + verify

  # Zips occ-N (hash/gid/ply, gid-major), positions-N (key/ph/gid/ply,
  # gid-major), moves-N (gid/sans) and games-N (gid/.../result) in one
  # pass: combined.tsv gets the full occurrence row, bookraw.tsv gets
  # (hash, gid, ply, move, result). Moves/results live in ETS (unsplit
  # strings — a Map of split lists is what OOM'd the broadcast build).
  defp combine!(occ_path, positions_path, moves_path, games_path, combined, bookraw) do
    games_count = line_count(games_path)

    moves = load_lookup(moves_path, :sans)
    results = load_lookup(games_path, :result)

    {:ok, out} = File.open(combined, [:raw, :write, {:delayed_write, 32 * 1024 * 1024, 30_000}])

    {:ok, bookout} =
      File.open(bookraw, [:raw, :write, {:delayed_write, 32 * 1024 * 1024, 30_000}])

    rows =
      occ_path
      |> Input.lines()
      |> Stream.zip(Input.lines(positions_path))
      |> Stream.chunk_every(400_000)
      |> Enum.reduce({0, nil, {[], nil}}, fn chunk, {count, cur_gid, cur_game} ->
        {buf, {cur_gid, cur_game}} =
          Enum.map_reduce(chunk, {cur_gid, cur_game}, fn {occ_line, pos_line},
                                                         {cur_gid, cur_game} ->
            [hash_hex, gid, ply] = String.split(occ_line, "\t")
            [key, pawn_hash, gid2, ply2] = String.split(pos_line, "\t")

            if gid != gid2 or ply != ply2 do
              raise "artifact misalignment at row #{count + 1}: occ #{gid}/#{ply} vs positions #{gid2}/#{ply2}"
            end

            gid_int = String.to_integer(gid)
            ply_int = String.to_integer(ply)

            # occ rows are gid-major: each game's sans+result are resolved
            # once per game (94M-row split was the earlier bottleneck).
            {cur_gid, {cur_sans, cur_result}} =
              if gid_int == cur_gid do
                {cur_gid, cur_game}
              else
                sans =
                  case :ets.lookup(moves, gid_int) do
                    [{^gid_int, sans_string}] -> String.split(sans_string, " ")
                    [] -> []
                  end

                result =
                  case :ets.lookup(results, gid_int) do
                    [{^gid_int, result_string}] -> result_string
                    [] -> nil
                  end

                {gid_int, {sans, result}}
              end

            case Enum.at(cur_sans, ply_int) do
              nil ->
                :ok

              "" ->
                :ok

              move ->
                IO.binwrite(bookout, [hash_hex, ?\t, gid, ?\t, move, ?\t, cur_result || "*", ?\n])
            end

            {[hash_hex, ?\t, pawn_hash, ?\t, gid, ?\t, ply, ?\t, key, ?\n],
             {cur_gid, {cur_sans, cur_result}}}
          end)

        IO.binwrite(out, buf)
        {count + length(chunk), cur_gid, cur_game}
      end)
      |> elem(0)

    File.close(out)
    File.close(bookout)
    :ets.delete(moves)
    :ets.delete(results)
    Mix.shell().info("combined #{rows} rows (#{games_count} games)")
    games_count
  end

  # gid => value, stored as the raw string (no split lists — those are what
  # cost gigabytes at broadcast scale).
  defp load_lookup(path, kind) do
    table = :ets.new(:lookup, [:set, :public])

    path
    |> Input.lines()
    |> Enum.each(fn line ->
      [gid | rest] = String.split(line, "\t")

      value =
        case kind do
          :sans -> Enum.at(rest, 0)
          :result -> Enum.at(rest, 2)
        end

      :ets.insert(table, {String.to_integer(gid), value})
    end)

    table
  end

  defp line_count(path) do
    path
    |> Input.lines()
    |> Enum.count()
  end

  ## External sort (hex hash order == binary byte order)

  defp sort!(combined, sorted) do
    {out, status} =
      System.cmd(
        "sort",
        [
          "-t",
          "\t",
          "-k1,1",
          "-k3,3n",
          "-k4,4n",
          "-S",
          "4G",
          "-T",
          Path.dirname(combined),
          "--parallel=8",
          combined,
          "-o",
          sorted
        ],
        stderr_to_stdout: true
      )

    if status != 0, do: Mix.raise("sort failed: #{out}")
    :ok
  end

  # Bookraw rows are (hash_hex, gid, move, result); sort by (hash, move,
  # gid) so per-(hash, move) aggregation is a linear scan with adjacent gid
  # dedup (independent games).
  defp sort_bookraw!(bookraw, sorted, tmp_dir) do
    {out, status} =
      System.cmd(
        "sort",
        [
          "-t",
          "\t",
          "-k1,1",
          "-k3,3",
          "-k2,2n",
          "-S",
          "4G",
          "-T",
          tmp_dir,
          "--parallel=8",
          bookraw,
          "-o",
          sorted
        ],
        stderr_to_stdout: true,
        env: [{"LC_ALL", "C"}]
      )

    if status != 0, do: Mix.raise("bookraw sort failed: #{out}")
    :ok
  end

  ## Gid-range segmentation

  defp gid_boundaries(games_count, 1), do: [{1, games_count}]

  defp gid_boundaries(games_count, n_segments) do
    per = div(games_count + n_segments - 1, n_segments)

    for i <- 0..(n_segments - 1) do
      {i * per + 1, min((i + 1) * per, games_count)}
    end
    |> Enum.reject(fn {lo, hi} -> lo > hi end)
  end

  # One pass over the sorted file, writing one temp file per gid range.
  # Returns [{path, distinct_gid_count}] in boundary order.
  defp split_segments(sorted, _tmp, [{lo, hi}], games_count) do
    # No split needed: the sorted file is the single segment input. When the
    # range covers every game, the distinct-gid count is the games count —
    # no re-parse of the full sorted file.
    if lo == 1 and hi == games_count do
      [{sorted, games_count}]
    else
      gids =
        sorted
        |> Input.lines()
        |> Stream.map(&parse_row/1)
        |> Stream.filter(fn {_hash, _ph, gid, _ply, _key} -> gid >= lo and gid <= hi end)
        |> Enum.reduce(MapSet.new(), fn {_h, _ph, gid, _p, _k}, acc -> MapSet.put(acc, gid) end)

      [{sorted, MapSet.size(gids)}]
    end
  end

  defp split_segments(sorted, tmp, boundaries, _games_count) do
    fds =
      for {lo, hi} <- boundaries do
        path = Path.join(tmp, "segment-#{lo}-#{hi}.tsv")
        {:ok, fd} = File.open(path, [:raw, :write, {:delayed_write, 32 * 1024 * 1024, 30_000}])
        {lo, hi, fd, path}
      end

    gid_sets =
      sorted
      |> Input.lines()
      |> Enum.reduce(Map.new(fds, fn {lo, _, _, _} -> {lo, MapSet.new()} end), fn line, acc ->
        row = parse_row(line)
        {_hash, _ph, gid, _ply, _key} = row

        case Enum.find(fds, fn {lo, hi, _fd, _path} -> gid >= lo and gid <= hi end) do
          nil ->
            acc

          {lo, _hi, fd, _path} ->
            IO.binwrite(fd, line)
            Map.update!(acc, lo, &MapSet.put(&1, gid))
        end
      end)

    Enum.map(fds, fn {lo, _hi, fd, path} ->
      File.close(fd)
      {path, MapSet.size(Map.fetch!(gid_sets, lo))}
    end)
  end

  ## Streams over a sorted combined file

  # {hash, gid, ply} — already sorted by (hash, gid, ply). Byte-chunked
  # line reading (Input.lines/1) is the difference between ~35k and ~1M
  # rows/s at corpus scale.
  defp occurrence_stream(path) do
    path
    |> Input.lines()
    |> Stream.map(fn line ->
      {hash, _pawn_hash, gid, ply, _key} = parse_row(line)
      {hash, gid, ply}
    end)
  end

  # {hash, pawn_hash, first_gid, first_ply, key} — the first row of each
  # hash run, already sorted by hash. Within a run rows are (gid, ply)
  # ascending, so the first row is the position's first occurrence.
  defp position_stream(path) do
    path
    |> Input.lines()
    |> Stream.map(&parse_row/1)
    |> Stream.transform(nil, fn row, prev_hash ->
      {hash, pawn_hash, gid, ply, key} = row

      if hash == prev_hash do
        {[], prev_hash}
      else
        {[{hash, pawn_hash, gid, ply, key}], hash}
      end
    end)
  end

  ## Book stream (per-key next-move distribution, precomputed)

  # bookraw-sorted.tsv is sorted by (hash, move, gid); each row is
  # (hash_hex, gid, move, result). Group runs of (hash, move) with adjacent
  # gid dedup (independent games), aggregate the result split, then emit
  # per hash sorted by (games desc, move). Terminal positions never appear
  # (no move row written at combine time).
  defp book_stream(bookraw_sorted_path, gid_lo, gid_hi) do
    bookraw_sorted_path
    |> Input.lines()
    |> Stream.map(fn line ->
      [hash_hex, gid, move, result] = String.split(line, "\t")
      {Base.decode16!(hash_hex, case: :lower), move, String.to_integer(gid), result}
    end)
    # A segment covers [gid_lo, gid_hi]; rows outside it belong to another
    # segment's book.
    |> Stream.filter(fn {_hash, _move, gid, _result} -> gid >= gid_lo and gid <= gid_hi end)
    |> Stream.transform(
      fn -> nil end,
      fn
        row, nil ->
          {[], book_acc_init(row)}

        row, acc ->
          {hash, move, gid, result} = row

          if hash == acc.hash do
            {[], book_acc_add(acc, move, gid, result)}
          else
            {[book_emit(acc)], book_acc_init(row)}
          end
      end,
      fn
        nil -> {[], []}
        acc -> {[book_emit(acc)], []}
      end
    )
  end

  # One hash's accumulator: the current (move, gid) run plus the finished
  # per-move counts.
  defp book_acc_init({hash, move, gid, result}) do
    %{
      hash: hash,
      cur_move: move,
      cur_gid: gid,
      cur: book_result_add(%{gids: 0, white: 0, draw: 0, black: 0}, result),
      done: []
    }
  end

  defp book_acc_add(acc, move, gid, result) do
    if move == acc.cur_move do
      if gid == acc.cur_gid do
        acc
      else
        %{acc | cur_gid: gid, cur: book_result_add(acc.cur, result)}
      end
    else
      %{
        acc
        | cur_move: move,
          cur_gid: gid,
          cur: book_result_add(%{gids: 0, white: 0, draw: 0, black: 0}, result),
          done: [{acc.cur_move, acc.cur} | acc.done]
      }
    end
  end

  defp book_emit(acc) do
    entries =
      [{acc.cur_move, acc.cur} | acc.done]
      |> Enum.map(fn {move, %{gids: g, white: w, draw: d, black: b}} -> {move, g, w, d, b} end)
      |> Enum.sort_by(fn {move, games, _w, _d, _b} -> {-games, move} end)

    {acc.hash, entries}
  end

  defp book_result_add(acc, result) do
    case result do
      "1-0" -> %{acc | white: acc.white + 1, gids: acc.gids + 1}
      "0-1" -> %{acc | black: acc.black + 1, gids: acc.gids + 1}
      _ -> %{acc | draw: acc.draw + 1, gids: acc.gids + 1}
    end
  end

  defp parse_row(line) do
    [hash_hex, pawn_hash, gid, ply, key] = String.split(String.trim_trailing(line, "\n"), "\t")

    {Base.decode16!(hash_hex, case: :lower), String.to_integer(pawn_hash), String.to_integer(gid),
     String.to_integer(ply), key}
  end

  ## Publication

  # Atomic publication: swap any previous output to a `<out>.prev` backup,
  # rename the build dir into place in one operation, then drop the backup.
  defp publish!(tmp, out) do
    if File.exists?(out) do
      File.rename!(out, "#{out}.prev")
    end

    File.rename!(tmp, out)

    if File.exists?("#{out}.prev") do
      File.rm_rf!("#{out}.prev")
    end

    :ok
  end
end
