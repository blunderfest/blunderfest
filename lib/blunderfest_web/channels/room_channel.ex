defmodule BlunderfestWeb.RoomChannel do
  alias BlunderfestWeb.Presence
  alias Blunderfest.Rooms

  use Phoenix.Channel

  require Logger

  intercept ["presence_diff"]

  @impl true
  def join("room:" <> room_code, _payload, socket) do
    if Rooms.exists?(room_code) do
      send(self(), {:after_join, room_code})
      {:ok, socket}
    else
      {:error, %{}}
    end
  end

  @impl true
  def handle_in(event, payload, socket) do
    Logger.warning("Invalid event #{event} #{inspect(payload)}")
    {:stop, :shutdown, socket}
  end

  @impl true
  def handle_info({:after_join, room_code}, %{assigns: %{user_id: user_id}} = socket) do
    room_code
    |> Rooms.get_events()
    |> Enum.each(fn event -> push(socket, event.type, event.payload) end)

    push(socket, "room/presenceState", %{"payload" => Presence.list(socket)})

    {:ok, _} = Presence.track(socket, user_id, %{
      online_at: inspect(System.system_time(:second))
    })

    {:noreply, socket}
  end

  @impl true
  def handle_out("presence_diff", payload, socket) do
    push(socket, "room/presenceDiff", %{ "payload" => payload })

    {:noreply, socket}
  end
end
