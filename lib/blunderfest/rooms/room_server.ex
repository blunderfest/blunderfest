defmodule Blunderfest.Rooms.RoomServer do
  alias Blunderfest.Rooms.Room

  @timeout 60 * 60 * 1000

  use GenServer, restart: :transient

  @spec start_link(String.t()) :: :ignore | {:error, any()} | {:ok, pid()}
  def start_link(room_code),
    do: GenServer.start_link(__MODULE__, room_code, name: via_tuple(room_code))

  def exists?(room_code) do
    case Registry.lookup(Blunderfest.RoomRegistry, room_code) do
      [{_pid, _}] -> true
      [] -> false
    end
  end

  def destroy(room_code),
    do:
      room_code
      |> via_tuple()
      |> GenServer.stop()

  def get_events(room_code),
    do:
      room_code
      |> via_tuple()
      |> GenServer.call(:get_events)

  @impl true
  def init(room_code), do: {:ok, Room.new(room_code), @timeout}

  def child_spec(room_code),
    do: %{
      id: __MODULE__,
      start: {__MODULE__, :start_link, [room_code]},
      restart: :transient
    }

  @impl true
  def handle_call(:get_events, _from, state) do
    {:reply, [%{type: "room/created", payload: %{}}], state, @timeout}
  end

  defp via_tuple(room_code), do: {:via, Registry, {Blunderfest.RoomRegistry, room_code}}
end
