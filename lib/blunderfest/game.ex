defmodule Blunderfest.Game do
  use TypedStruct

  @derive {Jason.Encoder, []}
  typedstruct module: Square do
    field(:rank, Integer.t(), enforce: true)
    field(:file, String.t(), enforce: true)
  end

  @derive {Jason.Encoder, []}
  typedstruct module: Move do
    field(:from, Integer.t(), enforce: true)
    field(:to, Integer.t(), enforce: true)
    field(:promotion, String.t())
  end

  @derive {Jason.Encoder, []}
  typedstruct module: Arrow do
    field(:from, Integer.t(), enforce: true)
    field(:to, Integer.t(), enforce: true)
    field(:color, String.t(), enforce: true)
  end

  @derive {Jason.Encoder, []}
  typedstruct module: Position do
    field(:id, String.t(), enforce: true)
    field(:fen, String.t(), enforce: true)
    field(:ply, Integer.t(), enforce: true)
    field(:arrows, list(Arrow.t()), enforce: true)
    field(:marks, list(String.t()), enforce: true)
    field(:selectedSquareIndex, Integer.t())
  end

  @derive {Jason.Encoder, []}
  typedstruct module: Variation do
    field(:move, Move.t(), enforce: true)
    field(:position, Position.t(), enforce: true)
    field(:variations, list(Variation.t()))
  end

  @derive {Jason.Encoder, []}
  typedstruct do
    field(:id, String.t(), enforce: true)
    field(:position, Position.t(), enforce: true)
    field(:variations, list(Variation.t()))
  end

  alias Nanoid

  def new(game_id) do
    %Blunderfest.Game{
      id: game_id,
      position: %{
        id: game_id <> "_pos_1",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        ply: 0,
        arrows: [],
        marks: [],
        selectedSquareIndex: nil
      },
      variations: []
    }
  end
end
