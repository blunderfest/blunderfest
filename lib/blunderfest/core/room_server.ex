defmodule Blunderfest.Core.RoomServer do
  alias Blunderfest.Core.Room

  use GenServer

  @timeout 24 * 60 * 60 * 1000

  def start_link(room_code),
    do: GenServer.start(__MODULE__, room_code, name: room_code |> via_tuple())

  @spec join(String.t(), String.t()) :: {:error, :room_not_found} | {:ok, Room.t()}
  def join(room_code, user_id) do
    if exists?(room_code) do
      Blunderfest.PubSub.subscribe(room_code)
      Blunderfest.PubSub.track(room_code, user_id)

      call_by_room_code(room_code, :join)
    else
      {:error, :room_not_found}
    end
  end

  def exists?(room_code) do
    !(room_code
      |> via_tuple()
      |> Horde.Registry.whereis()
      |> Enum.empty?())
  end

  def get(room_code) do
    {:ok, room} =
      room_code
      |> call_by_room_code(:get)

    room
  end

  def handle_event(room_code, raw_event, params) do
    result =
      room_code
      |> call_by_room_code({raw_event, params})

    Blunderfest.PubSub.broadcast_from(room_code, :update)

    result
  end

  defp call_by_room_code(room_code, message) when is_binary(room_code) do
    room_code
    |> via_tuple()
    |> GenServer.call(message)
  end

  defp via_tuple(room_code), do: {:via, Horde.Registry, {Blunderfest.RoomRegistry, room_code}}

  @impl true
  def init(room_code), do: {:ok, Room.new(room_code), @timeout}

  @impl true
  def handle_call(:join, _, state) do
    {:reply, {:ok, state}, state, @timeout}
  end

  @impl true
  def handle_call(:get, _, state) do
    {:reply, {:ok, state}, state, @timeout}
  end

  @impl true
  def handle_call({event, params}, _from, state) do
    new_state =
      event
      |> String.split("/")
      |> Room.handle_event(params, state)

    {:reply, {:ok, new_state}, new_state, @timeout}
  end

  @impl true
  def handle_info(:timeout, state) do
    {:stop, :normal, state}
  end
end
