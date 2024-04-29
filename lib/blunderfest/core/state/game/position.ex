defmodule Blunderfest.Core.State.Game.Position do
  alias Blunderfest.Core.State.Game.Square
  alias Blunderfest.Core.State.Game.Piece
  alias Blunderfest.Core.Parsers.FenParser

  use TypedStruct

  @derive Jason.Encoder
  typedstruct do
    field(:pieces, list(Piece.t() | nil))
    field(:active_color, Piece.color())
    field(:castling_availability, list(:K | :Q | :k | :q))
    field(:en_passant, Square.square_index() | nil)
    field(:halfmove_clock, integer())
    field(:fullmove_number, integer())
  end

  @starting_position "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

  def new() do
    {:ok, position} = parse(@starting_position)

    position
  end

  def parse(fen), do: FenParser.parse(fen)

  # defimpl Jason.Encoder, for: Tuple do
  #   def encode(value, opts) do
  #     FenParser.to_fen(value) |> Jason.Encode.string(opts)
  #   end
  # end
end
