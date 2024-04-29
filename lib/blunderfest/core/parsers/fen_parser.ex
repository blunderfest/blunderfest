defmodule Blunderfest.Core.Parsers.FenParser do
  alias Blunderfest.Core.State.Game.Piece
  alias Blunderfest.Core.State.Game.Position

  @spec to_fen(Position.t()) :: String.t()
  def to_fen(%Position{
        active_color: active_color,
        castling_availability: castling_availability,
        en_passant: en_passant,
        fullmove_number: fullmove_number,
        halfmove_clock: halfmove_clock,
        pieces: pieces
      }) do
    Enum.join(
      [
        Enum.chunk_every(pieces, 8)
        |> Enum.map(&serialize_row/1)
        |> Enum.join("/"),
        active_color |> serialize_color,
        castling_availability |> Enum.join(castling_availability),
        en_passant,
        halfmove_clock,
        fullmove_number
      ],
      " "
    )
  end

  def serialize_row(pieces) do
    pieces
    |> Enum.map(&serialize_piece/1)
    |> Enum.join("")
    |> replace_char_with_count(" ")
  end

  defp replace_char_with_count(string, char) do
    Regex.replace(~r/#{char}+/, string, fn x, _ -> String.length(x) |> Integer.to_string() end)
  end

  defp serialize_piece(nil), do: " "

  defp serialize_piece(%Piece{symbol: symbol}),
    do: symbol

  defp serialize_color(:black), do: "b"
  defp serialize_color(:white), do: "w"

  @spec parse(String.t()) ::
          {:error, :invalid_fen} | {:ok, Position.t()}
  def parse(fen) do
    try do
      [pieces, active_color, castling_availability, en_passant | rest] = String.split(fen, " ")

      {half_move_clock, move_number} =
        case rest do
          [hmc, mn] -> {String.to_integer(hmc), String.to_integer(mn)}
          [hmc] -> {String.to_integer(hmc), 1}
          [] -> {0, 1}
        end

      {:ok,
       %Position{
         pieces:
           pieces
           |> String.split("/")
           |> Enum.reverse()
           |> Enum.map(&parse_rows/1)
           |> List.flatten(),
         active_color: active_color |> to_charlist() |> parse_active_color(),
         castling_availability:
           castling_availability
           |> to_charlist()
           |> Enum.map(&parse_castling_availability/1)
           |> Enum.filter(fn castling -> castling != nil end),
         en_passant: en_passant |> to_charlist() |> parse_en_passant(),
         halfmove_clock: half_move_clock,
         fullmove_number: move_number
       }}
    rescue
      _ -> {:error, :invalid_fen}
    end
  end

  defp parse_rows(row),
    do:
      row
      |> String.split("", trim: true)
      |> Enum.map(fn c -> c |> to_charlist() |> hd() end)
      |> Enum.map(&parse_piece/1)

  defp parse_piece(?K), do: Piece.new(:K)
  defp parse_piece(?Q), do: Piece.new(:Q)
  defp parse_piece(?R), do: Piece.new(:R)
  defp parse_piece(?B), do: Piece.new(:B)
  defp parse_piece(?N), do: Piece.new(:N)
  defp parse_piece(?P), do: Piece.new(:P)

  defp parse_piece(?k), do: Piece.new(:k)
  defp parse_piece(?q), do: Piece.new(:q)
  defp parse_piece(?r), do: Piece.new(:r)
  defp parse_piece(?b), do: Piece.new(:b)
  defp parse_piece(?n), do: Piece.new(:n)
  defp parse_piece(?p), do: Piece.new(:p)

  defp parse_piece(n) when n in ?2..?8, do: [nil, parse_piece(n - 1)]
  defp parse_piece(?1), do: [nil]

  defp parse_active_color(~c"w"), do: :white
  defp parse_active_color(~c"b"), do: :black

  defp parse_castling_availability(?K), do: :K
  defp parse_castling_availability(?Q), do: :Q
  defp parse_castling_availability(?k), do: :k
  defp parse_castling_availability(?q), do: :q
  defp parse_castling_availability(_any), do: nil

  defp parse_en_passant([?-]), do: nil

  defp parse_en_passant([file, rank]) when file in ?a..?h and rank in ?1..?8,
    do: 8 * (rank - ?1) + (file - ?a)
end
