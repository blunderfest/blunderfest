defmodule Blunderfest.Corpus.Extraction do
  @moduledoc """
  Corpus extraction: streams a PGN file, replays every game's mainline, and
  writes the derived artifacts the corpus index is built from (port of Spike
  01/02 extraction; ADR-0026: PGN → moves → positions → indexes, everything
  after the PGN is derived and rebuildable).

      occ-N.tsv    position_hash128_hex \\t gid \\t ply    (one row per ply)
      games-N.tsv  gid \\t white \\t black \\t result \\t date \\t eco \\t opening
                   \\t white_elo \\t black_elo \\t event \\t time_control \\t site_id
      moves-N.tsv  gid \\t SAN SAN SAN ...                (mainline SAN list)
      keys-N.tsv   canonical_key \\t gid \\t ply          (one row per ply)
      extract-N.json  run statistics

  Games are processed in parallel batches, but output is written in corpus
  order (`ordered: true`), so a smaller tier's files are exact prefixes of a
  larger tier's files. The SAN list in `moves-N.tsv` is written raw (as
  played, without move numbers) so context windows around a ply are simple
  slices.

  A game whose replay fails still contributes its `games` and `moves` rows
  (the context is usable); only its per-ply key rows are lost.
  """

  alias Blunderfest.Corpus.{PositionKey, Replay}

  @batch_size 200

  @type stats :: %{
          games: non_neg_integer(),
          games_failed: non_neg_integer(),
          games_skipped: non_neg_integer(),
          plies: non_neg_integer(),
          failures: [{non_neg_integer(), term(), binary()}]
        }

  @doc """
  Extracts up to `games:` games from `corpus_path` into `out_dir` (default
  `"data/corpus"`). Returns the artifact paths, the run stats and the wall
  time in milliseconds.
  """
  @spec run(Path.t(), keyword()) :: %{paths: map(), stats: stats(), wall_ms: non_neg_integer()}
  def run(corpus_path, opts) do
    max_games = Keyword.fetch!(opts, :games)
    out_dir = Keyword.get(opts, :out_dir, "data/corpus")
    File.mkdir_p!(out_dir)

    paths = %{
      occ: Path.join(out_dir, "occ-#{max_games}.tsv"),
      games: Path.join(out_dir, "games-#{max_games}.tsv"),
      moves: Path.join(out_dir, "moves-#{max_games}.tsv"),
      keys: Path.join(out_dir, "keys-#{max_games}.tsv"),
      stats: Path.join(out_dir, "extract-#{max_games}.json")
    }

    {:ok, occ_io} = open_out(paths.occ)
    {:ok, games_io} = open_out(paths.games)
    {:ok, moves_io} = open_out(paths.moves)
    {:ok, keys_io} = open_out(paths.keys)

    started = System.monotonic_time(:millisecond)

    stats =
      corpus_path
      |> stream_games()
      |> Stream.take_while(fn {_game, gid} -> gid <= max_games end)
      |> Stream.chunk_every(@batch_size)
      |> Task.async_stream(&process_batch/1,
        ordered: true,
        timeout: :infinity,
        max_concurrency: System.schedulers_online()
      )
      |> Enum.reduce(empty_stats(), fn {:ok, batch}, acc ->
        IO.binwrite(occ_io, batch.occ)
        IO.binwrite(games_io, batch.games)
        IO.binwrite(moves_io, batch.moves)
        IO.binwrite(keys_io, batch.keys)
        merge_stats(acc, batch.stats)
      end)

    File.close(occ_io)
    File.close(games_io)
    File.close(moves_io)
    File.close(keys_io)

    wall_ms = System.monotonic_time(:millisecond) - started

    stats
    |> Map.put(:wall_ms, wall_ms)
    |> Map.update!(:failures, fn failures -> Enum.map(failures, &Tuple.to_list/1) end)
    |> then(&File.write!(paths.stats, Jason.encode!(&1, pretty: true)))

    %{paths: paths, stats: stats, wall_ms: wall_ms}
  end

  @doc """
  Streams `{headers, movetext}` tuples from a PGN file. `headers` is a map of
  tag name to value; `movetext` is the raw movetext binary. `game_id` is the
  1-based position of the game in the stream.

  Lichess database exports have a simple, robust shape: a block of `[Key
  "Value"]` header lines, a blank line, the movetext (usually one line), and
  a blank line before the next game. The segmenter is line-oriented and
  tolerant: movetext may span several lines, a new `[` after movetext also
  terminates the game, and a final game without a trailing blank line is
  emitted at end of file.
  """
  @spec stream_games(Path.t()) :: Enumerable.t()
  def stream_games(path) do
    path
    |> File.stream!(:line)
    |> Stream.concat([:eof])
    |> Stream.transform(:seek_headers, &segment/2)
    |> Stream.with_index(1)
  end

  defp segment(line, state)

  defp segment(:eof, {:in_movetext, headers_acc, movetext_acc}) do
    headers = Map.new(headers_acc)
    {[{headers, movetext_acc |> Enum.reverse() |> Enum.join("\n")}], :done}
  end

  defp segment(:eof, _state), do: {[], :done}

  defp segment(line, :seek_headers) do
    case String.trim_trailing(line, "\n") do
      "[" <> _ = header_line ->
        {[], {:in_headers, [parse_header(header_line)], []}}

      _ ->
        {[], :seek_headers}
    end
  end

  defp segment(line, {:in_headers, headers_acc, _}) do
    case String.trim_trailing(line, "\n") do
      "[" <> _ = header_line ->
        {[], {:in_headers, [parse_header(header_line) | headers_acc], []}}

      "" ->
        {[], {:in_movetext, headers_acc, []}}

      _other ->
        {[], {:in_headers, headers_acc, []}}
    end
  end

  defp segment(line, {:in_movetext, headers_acc, movetext_acc}) do
    trimmed = String.trim_trailing(line, "\n")

    cond do
      trimmed == "" ->
        headers = Map.new(headers_acc)
        {[{headers, movetext_acc |> Enum.reverse() |> Enum.join("\n")}], :seek_headers}

      String.starts_with?(trimmed, "[") ->
        # Defensive: a new tag section right after movetext (no blank line).
        headers = Map.new(headers_acc)
        game = {headers, movetext_acc |> Enum.reverse() |> Enum.join("\n")}
        {[game], {:in_headers, [parse_header(trimmed)], []}}

      true ->
        {[], {:in_movetext, headers_acc, [trimmed | movetext_acc]}}
    end
  end

  defp parse_header("[" <> rest) do
    case String.split(rest, "\"", parts: 3) do
      [key, value | _] -> {String.trim(key), value}
      _ -> {"?", "?"}
    end
  end

  defp open_out(path) do
    File.open(path, [:raw, :write, {:delayed_write, 16 * 1024 * 1024, 10_000}])
  end

  defp empty_stats, do: %{games: 0, games_failed: 0, games_skipped: 0, plies: 0, failures: []}

  defp process_batch(games) do
    games
    |> Enum.reduce(
      %{occ: [], games: [], moves: [], keys: [], stats: empty_stats()},
      fn {{headers, movetext}, gid}, acc ->
        case initial_game(headers) do
          :skip ->
            # A non-standard game (Chess960 / From-Position / etc.): its
            # positions are meaningless for a standard-chess book and would be
            # silently mis-keyed if replayed from the standard start. Dropped.
            %{acc | stats: %{acc.stats | games_skipped: acc.stats.games_skipped + 1}}

          {:ok, initial} ->
            sans = Replay.scan_sans(movetext)

            moves_line = [
              Integer.to_string(gid),
              ?\t,
              Enum.intersperse(sans, ?\s),
              ?\n
            ]

            case Replay.replay(initial, movetext) do
              {:ok, states} ->
                # Prepend the game's initial position (ply 0) so the start
                # position has occurrences too — otherwise the most-played
                # position of all has no first-move stats. `states` are the
                # positions after each ply; `initial` is the position before
                # ply 1.
                {occ_lines, key_lines, plies} =
                  [initial | states]
                  |> Enum.with_index(0)
                  |> Enum.reduce({[], [], 0}, fn {state, ply}, {occ, keys, n} ->
                    key = PositionKey.from_game(state)
                    hash_hex = PositionKey.to_hash128_hex(key)

                    occ = [
                      [hash_hex, ?\t, Integer.to_string(gid), ?\t, Integer.to_string(ply), ?\n]
                      | occ
                    ]

                    keys = [
                      [key, ?\t, Integer.to_string(gid), ?\t, Integer.to_string(ply), ?\n] | keys
                    ]

                    {occ, keys, n + 1}
                  end)

                stats = %{
                  acc.stats
                  | games: acc.stats.games + 1,
                    plies: acc.stats.plies + plies
                }

                %{
                  acc
                  | occ: [Enum.reverse(occ_lines) | acc.occ],
                    keys: [Enum.reverse(key_lines) | acc.keys],
                    moves: [moves_line | acc.moves],
                    games: [game_line(headers, gid) | acc.games],
                    stats: stats
                }

              {:error, reason, san} ->
                failures =
                  if length(acc.stats.failures) < 5,
                    do: acc.stats.failures ++ [{gid, reason, san}],
                    else: acc.stats.failures

                stats = %{
                  acc.stats
                  | games_failed: acc.stats.games_failed + 1,
                    failures: failures
                }

                %{
                  acc
                  | moves: [moves_line | acc.moves],
                    games: [game_line(headers, gid) | acc.games],
                    stats: stats
                }
            end
        end
      end
    )
    |> then(fn acc ->
      %{
        occ: Enum.reverse(acc.occ),
        games: Enum.reverse(acc.games),
        moves: Enum.reverse(acc.moves),
        keys: Enum.reverse(acc.keys),
        stats: acc.stats
      }
    end)
  end

  # Whether a game is a standard-chess game from the standard start. We only
  # keep those: a non-Standard Variant (Chess960) or any SetUp tag
  # (From-Position) starts from a position the standard-chess book has no use
  # for, and replaying it from the standard start would silently mis-key every
  # position. Such games are skipped, not extracted.
  defp initial_game(headers) do
    if Map.get(headers, "Variant", "Standard") == "Standard" and
         Map.get(headers, "SetUp") == nil do
      {:ok, Echecs.new_game()}
    else
      :skip
    end
  end

  defp game_line(headers, gid) do
    [
      Integer.to_string(gid),
      ?\t,
      clean(Map.get(headers, "White", "?")),
      ?\t,
      clean(Map.get(headers, "Black", "?")),
      ?\t,
      clean(Map.get(headers, "Result", "*")),
      ?\t,
      clean(game_date(headers)),
      ?\t,
      clean(Map.get(headers, "ECO", "?")),
      ?\t,
      clean(Map.get(headers, "Opening", "?")),
      ?\t,
      clean(elo(Map.get(headers, "WhiteElo", "?"))),
      ?\t,
      clean(elo(Map.get(headers, "BlackElo", "?"))),
      ?\t,
      clean(Map.get(headers, "Event", "?")),
      ?\t,
      clean(Map.get(headers, "TimeControl", "?")),
      ?\t,
      site_id(Map.get(headers, "Site", "?")),
      ?\n
    ]
  end

  # An Elo is an integer; anything else ("?", "N/A", "") becomes "?" — the
  # unknown marker the loader maps to NULL (the COPY integer columns reject
  # non-numeric text).
  defp elo(v) do
    case Integer.parse(v) do
      {_, ""} -> v
      _ -> "?"
    end
  end

  defp site_id(site) do
    site |> String.replace_prefix("https://lichess.org/", "") |> clean()
  end

  defp merge_stats(acc, batch_stats) do
    %{
      acc
      | games: acc.games + batch_stats.games,
        games_failed: acc.games_failed + batch_stats.games_failed,
        games_skipped: acc.games_skipped + batch_stats.games_skipped,
        plies: acc.plies + batch_stats.plies,
        failures: Enum.take(acc.failures ++ batch_stats.failures, 5)
    }
  end

  # The game's date: `UTCDate` (the lichess export convention) falling back to
  # `Date` (the Seven-Tag-Roster field the broadcast database uses).
  defp game_date(headers) do
    Map.get(headers, "UTCDate") || Map.get(headers, "Date") || "?"
  end

  defp clean(nil), do: "?"

  # PGN header text → one COPY field: tabs/newlines/CRs become spaces, and a
  # backslash becomes a forward slash (COPY's text format treats `\` as an
  # escape — a raw backslash before a tab/newline corrupts the row).
  defp clean(v) when is_binary(v) do
    v
    |> String.replace(["\t", "\n", "\r"], " ")
    |> String.replace("\\", "/")
    |> String.trim()
    |> then(fn s ->
      if String.valid?(s), do: s, else: :unicode.characters_to_binary(s, :latin1, :utf8)
    end)
  end
end
