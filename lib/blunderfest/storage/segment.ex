defmodule Blunderfest.Storage.Segment do
  @moduledoc """
  Segment management for append-only game storage.
  """

  @magic "BCHS"
  @version 1
  @segment_header_size 64
  @footer_size 32

  @type t :: %__MODULE__{
    id: String.t(),
    path: String.t(),
    game_count: non_neg_integer(),
    position_count: non_neg_integer()
  }

  defstruct [:id, :path, :game_count, :position_count]

  @spec create(String.t(), String.t()) :: {:ok, t()} | {:error, term()}
  def create(segment_id, storage_path) do
    path = Path.join(storage_path, "#{segment_id}.bchess")

    with :ok <- File.touch(path),
         :ok <- write_header(path, segment_id) do
      {:ok, %__MODULE__{
        id: segment_id,
        path: path,
        game_count: 0,
        position_count: 0
      }}
    else
      error -> error
    end
  end

  @spec read(String.t(), String.t()) :: {:ok, t()} | {:error, term()}
  def read(segment_id, storage_path) do
    path = Path.join(storage_path, "#{segment_id}.bchess")

    case File.read(path) do
      {:ok, data} ->
        parse_segment(segment_id, path, data)

      {:error, reason} ->
        {:error, reason}
    end
  end

  @spec append(t(), map()) :: {:ok, t()} | {:error, term()}
  def append(%__MODULE__{} = segment, game_data) do
    encoded = encode_game(game_data)
    checksum = :erlang.crc32(encoded)

    data = <<byte_size(encoded)::32, encoded::binary, checksum::32>>

    case File.write(segment.path, data, [:append, :raw]) do
      :ok ->
        {:ok, %{segment | game_count: segment.game_count + 1}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @spec append(String.t(), map(), String.t()) :: {:ok, t()} | {:error, term()}
  def append(segment_id, game_data, storage_path) do
    case read(segment_id, storage_path) do
      {:ok, segment} ->
        append(segment, game_data)

      {:error, :enoent} ->
        with {:ok, segment} <- create(segment_id, storage_path) do
          append(segment, game_data)
        end
    end
  end

  defp write_header(path, segment_id) do
    header = <<
      @magic::binary,
      @version::16,
      0::16,
      0::64,
      0::64,
      0::64,
      0::64,
      0::64,
      0::64,
      0::64,
      0::64
    >>

    File.write(path, header, [:raw])
  end

  defp parse_segment(id, path, data) do
    <<
      magic::binary-size(4),
      _version::16,
      _flags::16,
      game_count::64,
      position_count::64,
      _rest::binary
    >> = data

    {:ok, %__MODULE__{
      id: id,
      path: path,
      game_count: game_count,
      position_count: position_count
    }}
  end

  defp encode_game(game_data) do
    :erlang.term_to_binary(game_data)
  end
end
