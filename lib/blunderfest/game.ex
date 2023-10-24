defmodule Blunderfest.Move do
  use TypedStruct

  alias __MODULE__
  alias Blunderfest.Position

  @derive {Jason.Encoder, only: [:san, :position]}
  typedstruct do
    field(:san, String.t(), enforce: true)
    field(:position, Position.t(), enforce: true)
  end

  def new(san),
    do: %Move{
      san: san,
      position: Position.new2()
    }
end

defmodule Blunderfest.Position do
  use TypedStruct

  alias __MODULE__
  alias Blunderfest.Move

  @derive {Jason.Encoder, only: [:fen, :selectedSquare, :moves]}
  typedstruct do
    field(:fen, String.t(), enforce: true)
    field(:selectedSquare, String.t())
    field(:moves, list(Move.t()))
  end

  def new(),
    do: %Position{
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
      selectedSquare: 12,
      moves: [
        Move.new("e2e4")
      ]
    }

  def new2(),
    do: %Position{
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
      selectedSquare: 20
    }
end

defmodule Blunderfest.Game do
  use TypedStruct

  alias __MODULE__
  alias Blunderfest.Position

  @derive {Jason.Encoder, only: [:id, :positions, :currentPosition]}
  typedstruct do
    field(:id, String.t(), enforce: true)
    field(:positions, list(Position.t()))
    field(:currentPosition, list(Integer.t()), enforce: true)
  end

  def new(game_id),
    do: %Game{
      id: game_id,
      positions: [
        Position.new()
      ],
      currentPosition: [0, 0]
    }
end
