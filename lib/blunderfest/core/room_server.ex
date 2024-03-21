defmodule Blunderfest.Core.RoomServer do
  alias Blunderfest.Core.Room

  use GenServer

  @timeout 24 * 60 * 60 * 1000

  def start_link(room_code),
    do: GenServer.start(__MODULE__, room_code, name: room_code |> via_tuple())

  @spec join(String.t(), String.t()) :: {:error, :room_not_found} | {:ok, Room.t()}
  def join(room_code, user_id) do
    if exists?(room_code) do
      Blunderfest.PubSub.track(room_code, user_id)

      call_by_room_code(room_code, :join)
    else
      {:error, :room_not_found}
    end
  end

  def exists?(room_code) do
    IO.puts("Check if room exists")

    e =
      !(room_code
        |> via_tuple()
        |> Horde.Registry.whereis()
        |> Enum.empty?())

    IO.puts("Exists? #{e}")

    e
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

    Blunderfest.PubSub.broadcast_from(room_code, raw_event, params)

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
  def handle_call({event, %{meta: meta, payload: payload}}, _from, state) do
    IO.puts("HANDLE #{event}")

    new_state =
      event
      |> String.split("/")
      |> Room.handle_event(meta, payload, state)

    {:reply, {:ok, new_state}, new_state, @timeout}
  end

  @impl true
  def handle_info(:timeout, state) do
    {:stop, :normal, state}
  end
end
