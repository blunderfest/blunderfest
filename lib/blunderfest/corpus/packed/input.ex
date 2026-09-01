defmodule Blunderfest.Corpus.Packed.Input do
  @moduledoc """
  Byte-chunked line reader for the packed build path (Spike 08).

  `File.stream!(:line)` costs a port round trip per line (~35k rows/s at
  corpus scale — the first full-corpus build bottleneck). This reader pulls
  raw byte chunks and splits lines in memory; at the corpus tier the whole
  stream parses at ~1M rows/s.
  """

  @chunk_bytes 8 * 1024 * 1024

  @doc "Lines of the file (newlines stripped; a final unterminated line is included)."
  @spec lines(Path.t()) :: Enumerable.t(String.t())
  def lines(path) do
    path
    |> File.stream!(@chunk_bytes, [])
    |> Stream.chunk_while(
      "",
      fn chunk, leftover ->
        # `leftover` is the unterminated tail of the previous chunk.
        lines = String.split(leftover <> chunk, "\n")
        {complete, tail} = lines |> Enum.split(-1) |> then(fn {l, t} -> {l, List.first(t)} end)
        {:cont, complete, tail}
      end,
      fn leftover ->
        # EOF: the leftover is a real final line only when nonempty.
        if leftover == "" do
          {:cont, []}
        else
          {:cont, [leftover]}
        end
      end
    )
    |> Stream.flat_map(& &1)
  end
end
