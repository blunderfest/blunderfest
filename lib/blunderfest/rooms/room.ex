defmodule Blunderfest.Rooms.Room do
  alias Blunderfest.Rooms.Room
  alias Blunderfest.Games.Game

  use TypedStruct

  @derive Jason.Encoder
  typedstruct enforce: true do
    field :room_code, String.t()
    field :current_game, Game.t()
    field :games, list(Game.t())
  end

  def new(room_code) do
    game_code = Nanoid.generate()

    %Room{
      room_code: room_code,
      current_game: game_code,
      games: [Game.new(game_code)]
    }
  end
end
