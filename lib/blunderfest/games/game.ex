defmodule Blunderfest.Games.Game do
  alias Blunderfest.Games.Game
  alias Blunderfest.Games.Variation
  alias Blunderfest.Games.Position

  use TypedStruct

  @derive Jason.Encoder
  typedstruct enforce: true do
    field :game_code, String.t()
    field :starting_position, Position.t()
    field :variations, list(Variation.t())
  end

  def new(game_code) do
    %Game{
      game_code: game_code,
      starting_position: Position.new(),
      variations: []
    }
  end
end
