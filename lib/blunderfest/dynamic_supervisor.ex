defmodule Blunderfest.DynamicSupervisor do
  alias Blunderfest.Game.State.Game
  alias Blunderfest.Game.GameServer
  alias Blunderfest.Game.RoomServer
  alias Blunderfest.Game.State.Room

  use Horde.DynamicSupervisor

  def start_link(init_arg, options \\ []) do
    Horde.DynamicSupervisor.start_link(__MODULE__, init_arg, options)
  end

  @impl true
  def init(init_arg) do
    [strategy: :one_for_one, members: members()]
    |> Keyword.merge(init_arg)
    |> Horde.DynamicSupervisor.init()
  end

  defp members() do
    []
  end

  @spec create_room(Room.room_code()) :: any()
  def create_room(room_code) do
    Horde.DynamicSupervisor.start_child(__MODULE__, {RoomServer, room_code})
  end

  @spec create_game(Game.game_code()) :: any()
  def create_game(game_code) do
    Horde.DynamicSupervisor.start_child(__MODULE__, {GameServer, game_code})
  end
end
