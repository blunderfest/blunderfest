defmodule Blunderfest.Corpus.Packed.Manifest do
  @moduledoc """
  The packed corpus manifest (Spike 08, §19): a small, explicit JSON
  document at the packed data directory root listing the segments the
  backend may open.

      {
        "version": 1,
        "segments": [
          {
            "id": "seg-000001",
            "games": 100000,
            "occurrences": 6814883,
            "positions": 5833794,
            "gids": {"min": 1, "max": 100000},
            "files": {
              "occ":    {"path": "seg-000001/occ.bin",   "bytes": ..., "sha256": "..."},
              "pos":    {"path": "seg-000001/pos.bin",   "bytes": ..., "sha256": "..."},
              "bucket": {"path": "seg-000001/bucket.bin","bytes": ..., "sha256": "..."}
            }
          }
        ]
      }

  Open-time validation: segment ids unique, files exist, byte sizes match
  the manifest exactly. Checksums are verified only when `:verify_checksums`
  is passed (they cost one full read of every file).

  ## Versions (Spike 09 Phase 2)

  `"version"` is the manifest format version; each segment additionally
  records `"pos_version"` — the pos.bin header format of that segment (1 =
  36-byte headers, 2 = 49-byte headers with the pack-time statistics; a
  missing entry means v1). Open accepts every supported version pair and
  rejects unknown ones, so v1 and v2 directories coexist during rollout and
  a rollback is a `PACKED_DIR` flip.
  """

  @version 2
  @supported_versions [1, 2]
  @supported_pos_versions [1, 2]

  @doc "Current manifest format version written by `write!/3` by default."
  def version, do: @version

  @doc "Manifest versions `open/2` accepts."
  def supported_versions, do: @supported_versions

  @doc "Manifest path of a packed data directory."
  def path(dir), do: Path.join(dir, "manifest.json")

  @doc """
  Writes the manifest file (pretty-printed JSON through Jason). `version`
  defaults to the current version; each segment doc carries the segment's
  `pos_version` (default 1).
  """
  def write!(dir, segments, version \\ @version) when is_list(segments) do
    doc = %{"version" => version, "segments" => Enum.map(segments, &segment_doc/1)}
    File.write!(path(dir), Jason.encode!(doc, pretty: true))
    :ok
  end

  defp segment_doc(entry) do
    %{
      "id" => entry.id,
      "games" => entry.games,
      "occurrences" => entry.occurrences,
      "positions" => entry.positions,
      "book_records" => entry.book_records,
      "pos_version" => Map.get(entry, :pos_version, 1),
      "gids" => %{"min" => entry.gids.min, "max" => entry.gids.max},
      "files" => entry.files
    }
  end

  @doc """
  Reads and validates a manifest. Returns `{:ok, manifest}` where each
  segment's file entries are validated for byte size (and optional
  checksum). Returns `{:error, reason}` describing the first problem.
  """
  def open(dir, opts \\ []) do
    with {:ok, json} <- read_json(path(dir)),
         :ok <- validate_version(json),
         {:ok, segments} <- validate_segments(dir, json, opts) do
      {:ok, %{dir: dir, version: json["version"], segments: segments}}
    end
  end

  defp read_json(path) do
    case File.read(path) do
      {:ok, contents} ->
        case Jason.decode(contents) do
          {:ok, json} -> {:ok, json}
          {:error, reason} -> {:error, {:invalid_manifest_json, reason}}
        end

      {:error, reason} ->
        {:error, {:manifest_unreadable, reason}}
    end
  end

  defp validate_version(%{"version" => version}) when version in @supported_versions, do: :ok

  defp validate_version(%{"version" => other}),
    do: {:error, {:unsupported_manifest_version, other}}

  defp validate_version(_), do: {:error, :missing_manifest_version}

  defp validate_segments(dir, %{"segments" => segments}, opts) when is_list(segments) do
    ids = Enum.map(segments, & &1["id"])

    if length(ids) != length(Enum.uniq(ids)) do
      {:error, :duplicate_segment_id}
    else
      segments
      |> Enum.reduce_while({:ok, []}, fn seg, {:ok, acc} ->
        case validate_segment(dir, seg, opts) do
          {:ok, segment} -> {:cont, {:ok, [segment | acc]}}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end)
      |> case do
        {:ok, segs} -> {:ok, Enum.reverse(segs)}
        error -> error
      end
    end
  end

  defp validate_segments(_dir, _json, _opts), do: {:error, :manifest_missing_segments}

  defp validate_segment(dir, seg, opts) do
    with {:ok, pos_version} <- validate_pos_version(seg),
         {:ok, files} <- validate_files(dir, seg, opts) do
      {:ok,
       %{
         id: seg["id"],
         games: seg["games"],
         occurrences: seg["occurrences"],
         positions: seg["positions"],
         book_records: seg["book_records"],
         pos_version: pos_version,
         gids: %{"min" => get_in(seg, ["gids", "min"]), "max" => get_in(seg, ["gids", "max"])},
         files: files
       }}
    end
  end

  # A missing pos_version means a v1 manifest/segment (the field did not
  # exist before format v2).
  defp validate_pos_version(seg) do
    case Map.get(seg, "pos_version", 1) do
      pos_version when pos_version in @supported_pos_versions -> {:ok, pos_version}
      other -> {:error, {:segment, seg["id"], {:unsupported_pos_version, other}}}
    end
  end

  defp validate_files(dir, seg, opts) do
    files = Map.get(seg, "files", %{})

    required = ~w(occ pos bucket book)

    case Enum.find(required, &(not Map.has_key?(files, &1))) do
      nil ->
        files
        |> Map.take(required)
        |> Enum.reduce_while({:ok, %{}}, fn {kind, info}, {:ok, acc} ->
          case validate_file(dir, info, opts) do
            {:ok, path} -> {:cont, {:ok, Map.put(acc, kind, path)}}
            {:error, reason} -> {:halt, {:error, {:segment, seg["id"], reason}}}
          end
        end)

      missing ->
        {:error, {:segment, seg["id"], {:missing_file_entry, missing}}}
    end
  end

  defp validate_file(dir, %{"path" => rel, "bytes" => bytes} = info, opts) do
    full = Path.join(dir, rel)

    case File.stat(full) do
      {:ok, %{size: ^bytes}} ->
        if Keyword.get(opts, :verify_checksums, false) do
          case verify_checksum(full, Map.get(info, "sha256")) do
            :ok -> {:ok, full}
            error -> error
          end
        else
          {:ok, full}
        end

      {:ok, %{size: actual}} ->
        {:error, {:file_size_mismatch, rel, actual, bytes}}

      {:error, reason} ->
        {:error, {:file_unreadable, rel, reason}}
    end
  end

  defp validate_file(_dir, info, _opts), do: {:error, {:invalid_file_entry, info}}

  defp verify_checksum(_path, nil), do: :ok

  defp verify_checksum(path, expected) do
    digest = :crypto.hash_init(:sha256)

    digest =
      path
      |> File.stream!(4 * 1024 * 1024, [])
      |> Enum.reduce(digest, fn chunk, acc -> :crypto.hash_update(acc, chunk) end)

    actual = :crypto.hash_final(digest) |> Base.encode16(case: :lower)

    if actual == expected do
      :ok
    else
      {:error, {:checksum_mismatch, Path.basename(path), actual, expected}}
    end
  end
end
