defmodule Blunderfest.Core.RoomServer do
  alias BlunderfestWeb.Presence
  alias Blunderfest.Core.Room

  use GenServer

  @timeout 24 * 60 * 60 * 1000

  def start_link(room_code),
    do: GenServer.start(__MODULE__, room_code, name: room_code |> via_tuple())

  @spec join(String.t(), String.t()) :: {:error, :room_not_found} | {:ok, String.t()}
  def join(room_code, user_id) do
    room_code
    |> topic()
    |> subscribe()
    |> track(user_id)

    call_by_room_code(room_code, :join)
    |> case do
      {:error, _} -> {:error, :room_not_found}
      :ok -> {:ok, room_code}
    end
  end

  def get(room_code) do
    room_code
    |> call_by_room_code(:get)
  end

  def handle_event(room_code, raw_event, params) do
    room_code
    |> cast_by_room_code({raw_event, params})

    Phoenix.PubSub.broadcast(Blunderfest.PubSub, topic(room_code), :update)
  end

  defp subscribe(topic) do
    Phoenix.PubSub.subscribe(Blunderfest.PubSub, topic)
    topic
  end

  defp track(topic, user_id) do
    Presence.track_user(topic, user_id)
    topic
  end

  defp call_by_room_code(room_code, message) when is_binary(room_code) do
    room_code
    |> via_tuple()
    |> GenServer.call(message)
  end

  defp cast_by_room_code(room_code, message) do
    room_code
    |> via_tuple()
    |> GenServer.cast(message)
  end

  defp via_tuple(room_code), do: {:via, Registry, {Blunderfest.RoomRegistry, room_code}}

  defp topic(room_code), do: "room:#{room_code}"

  @impl true
  def init(room_code), do: {:ok, Room.new(room_code), @timeout}

  @impl true
  def handle_call(:join, _, state) do
    {:reply, :ok, state, @timeout}
  end

  @impl true
  def handle_call(:get, _, state) do
    {:reply, state, state, @timeout}
  end

  @impl true
  def handle_cast({event, params}, state) do
    {:noreply,
     event
     |> normalize_event()
     |> Room.handle_event(params, state)}
  end

  @impl true
  def handle_info(:timeout, state) do
    {:stop, :normal, state}
  end

  defp normalize_event(event), do: event |> String.split("/")
end
