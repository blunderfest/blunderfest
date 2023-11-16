defmodule Blunderfest.Game.RoomServer do
  alias Blunderfest.Game.State.Room

  use GenServer

  def child_spec(room_code) do
    %{
      id: __MODULE__,
      start: {__MODULE__, :start_link, [room_code]},
      restart: :transient
    }
  end

  @spec start_link(Room.room_code()) :: :ignore | {:error, any()} | {:ok, pid()}
  def start_link(room_code) do
    room = Room.new(room_code)
    GenServer.start_link(__MODULE__, room, name: via_tuple(room_code))
  end

  defp via_tuple(room_code) do
    {:via, Horde.Registry, {Blunderfest.Registry, room_code}}
  end

  @spec get_room(Room.room_code()) :: Room.t()
  def get_room(room_code) do
    room_code
    |> via_tuple()
    |> GenServer.call(:get_room)
  end

  @spec server_found?(Room.room_code()) :: boolean()
  def server_found?(room_code) do
    case Horde.Registry.lookup(Blunderfest.Registry, room_code) do
      [] -> false
      [{pid, _} | _] when is_pid(pid) -> true
    end
  end

  @impl true
  def init(room) do
    {:ok, room}
  end

  @impl true
  def handle_call(:get_room, _from, state) do
    {:reply, state, state}
  end
end
