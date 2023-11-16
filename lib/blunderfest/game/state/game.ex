defmodule Blunderfest.Game.State.Game do
  use TypedStruct

  alias Blunderfest.Game.State.Variation
  alias Blunderfest.Game.State.Position

  @type game_code :: String.t()

  @derive {Jason.Encoder, []}
  typedstruct do
    field(:game_code, game_code(), enforce: true)
    field(:position, Position.t(), enforce: true)
    field(:variations, list(Variation.t()))
  end

  def new(game_code) do
    %__MODULE__{
      game_code: game_code,
      position: %{
        position_id: game_code <> "_pos_1",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        ply: 0,
        arrows: [],
        marks: [],
        selected_square_index: nil
      },
      variations: []
    }
  end
end
