defmodule Blunderfest.Game.GameServer do
  alias Blunderfest.Game.State.Game

  use GenServer

  def child_spec(game_code) do
    %{
      id: __MODULE__,
      start: {__MODULE__, :start_link, [game_code]},
      restart: :transient
    }
  end

  def start_link(game_code) do
    GenServer.start_link(__MODULE__, game_code, name: via_tuple(game_code))
  end

  defp via_tuple(game_code) do
    {:via, Horde.Registry, {Blunderfest.Registry, game_code}}
  end

  def get_game(game_code) do
    game_code
    |> via_tuple()
    |> GenServer.call(:get_game)
  end

  @impl true
  def init(game_code) do
    {:ok, Game.new(game_code)}
  end

  @impl true
  def handle_call(:get_game, _from, state) do
    {:reply, state, state}
  end
end
