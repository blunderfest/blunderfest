defmodule Blunderfest.Game do
  use TypedStruct

  alias __MODULE__
  alias Blunderfest.Game.Square

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
    field(:fen, String.t(), enforce: true)
    field(:ply, Integer.t(), enforce: true)
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

  def new(game_id),
    do: %Game{
      id: game_id,
      position: %{
        fen: "4r3/2P3R1/R1N2k1P/5Np1/K1p1p3/1pr5/3P4/Bn3Q2 w - - 0 1",
        ply: 0
      },
      variations: [
        %{
          move: %{
            from: 11,
            to: 27
          },
          position: %{
            fen: "4r3/2P3R1/R1N2k1P/5Np1/K1pPp3/1pr5/8/Bn3Q2 b - d3 0 1",
            ply: 1
          },
          variations: []
        }
      ]
    }
end
