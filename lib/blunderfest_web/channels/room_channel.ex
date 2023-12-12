defmodule BlunderfestWeb.RoomChannel do
  use BlunderfestWeb, :channel

  alias Blunderfest.Game.GameServer
  alias Blunderfest.Game.RoomServer
  alias Blunderfest.Game.IdGenerator
  alias BlunderfestWeb.Presence

  @impl true
  def join(
        "room:" <> room_code,
        payload,
        socket
      ) do
    user_id = IdGenerator.generate()
    {:ok, _} = Presence.track_user(socket, room_code, user_id)

    send(self(), :after_join)

    {:ok,
     %{
       user_id: user_id
     }, socket |> assign(:user_id, user_id) |> assign(:room_code, room_code)}
  end

  @impl true
  def handle_in(
        "move/piece",
        %{
          "move" => move,
          "gameCode" => game_code,
          "positionId" => positionId
        },
        socket
      ) do
    broadcast(socket, "piece/moved", %{
      "gameCode" => game_code,
      "position" => %{
        "positionId" => positionId <> "_new",
        "fen" => "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
        "ply" => 12
      },
      "move" => move,
      "variations" => []
    })

    {:noreply, socket}
  end

  # It is also common to receive messages from the client and
  # broadcast to everyone in the current topic (room:lobby).
  @impl true
  def handle_in(
        event,
        payload,
        socket
      ) do
    socket |> broadcast(event, payload)
    {:noreply, socket}
  end

  @impl true
  def handle_info(:after_join, %{assigns: %{room_code: room_code, user_id: user_id}} = socket) do
    push(socket, "presence_state", %{users: Presence.list_users(room_code)})
    # Phoenix.PubSub.subscribe(Blunderfest.PubSub, "room:" <> socket.assigns.room_code)

    room = RoomServer.get_room(room_code)

    room.game_codes
    |> Enum.map(fn game_code -> GameServer.get_game(game_code) end)
    |> Enum.each(fn game ->
      # Phoenix.PubSub.subscribe(Blunderfest.PubSub, "game:" <> game.game_code)

      socket
      |> pushToClients("game/added", game)
    end)

    {:noreply, socket}
  end

  @impl true
  def handle_info(%{event: "presence_diff"}, socket) do
    document = socket.assigns.document
    send_update(EditorWeb.DocumentActivityLive, id: "doc#{document.id}", document: document)

    {:noreply, socket}
  end

  defp pushToClients(socket, event, payload) when is_struct(payload) do
    socket
    |> push(
      event,
      payload |> Map.from_struct() |> Recase.Enumerable.convert_keys(&Recase.to_camel/1)
    )

    {:noreply, socket}
  end

  defp pushToClients(socket, event, payload) do
    socket
    |> push(event, payload)

    {:noreply, socket}
  end
end
