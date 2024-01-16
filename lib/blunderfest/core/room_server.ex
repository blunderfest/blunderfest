defmodule Blunderfest.Core.RoomServer do
  alias Blunderfest.Core.Room
  use GenServer

  def start_link(room_code),
    do: GenServer.start(__MODULE__, room_code, name: room_code |> via_tuple())

  def room_pid(room_code), do: room_code |> via_tuple() |> GenServer.whereis()

  def join(room_code) do
    IO.puts("join: #{inspect(self())}")

    Phoenix.PubSub.subscribe(Blunderfest.PubSub, "room:#{room_code}")

    call_by_room_code(room_code, :join)
  end

  def call_by_room_code(room_code, command) do
    case room_pid(room_code) do
      room_pid when is_pid(room_pid) -> GenServer.call(room_pid, command)
      nil -> {:error, :room_not_found}
    end
  end

  def cast_by_room_code(room_code, command) do
    case room_pid(room_code) do
      room_pid when is_pid(room_pid) -> GenServer.cast(room_pid, command)
      nil -> {:error, :room_not_found}
    end
  end

  defp via_tuple(room_code), do: {:via, Registry, {Blunderfest.RoomRegistry, room_code}}

  @impl true
  def init(room_code), do: {:ok, Room.new(room_code)}

  @impl true
  def handle_call(:join, _, state) do
    {:reply, state, state}
  end
end
