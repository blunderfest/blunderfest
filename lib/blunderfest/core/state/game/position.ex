defmodule Blunderfest.Core.State.Game.Position do
  alias Blunderfest.Core.Parsers.FenParser
  alias Blunderfest.Core.State.Game.Square
  alias Blunderfest.Core.State.Game.Piece

  @type t() :: %__MODULE__{
          pieces: list(Piece.t() | nil),
          active_color: Piece.color(),
          castling_availability: list({Piece.color(), :king | :queen}),
          en_passant: Square.square_index() | nil,
          halfmove_clock: integer(),
          fullmove_number: integer()
        }

  defstruct [
    :pieces,
    :active_color,
    :castling_availability,
    :en_passant,
    :halfmove_clock,
    :fullmove_number
  ]

  @starting_position "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

  def new(), do: parse(@starting_position)

  def parse(fen), do: FenParser.parse(fen)
end
