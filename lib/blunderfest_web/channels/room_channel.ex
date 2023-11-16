defmodule BlunderfestWeb.RoomChannel do
  use BlunderfestWeb, :channel

  alias Blunderfest.Game.GameServer
  alias Blunderfest.Game.RoomServer
  alias Blunderfest.Game.IdGenerator
  alias BlunderfestWeb.Presence

  @impl true
  def join("room:" <> roomCode, _payload, socket) do
    user_id = IdGenerator.generate()

    send(self(), :after_join)

    {:ok,
     %{
       user_id: user_id
     }, socket |> assign(:user_id, user_id) |> assign(:room_code, roomCode)}
  end

  # Channels can be used in a request/response fashion
  # by sending replies to requests from the client
  @impl true
  def handle_in("ping", payload, socket) do
    {:reply, {:ok, payload}, socket}
  end

  # It is also common to receive messages from the client and
  # broadcast to everyone in the current topic (room:lobby).
  @impl true
  def handle_in(
        "shout",
        %{
          "type" => "movePiece",
          "payload" => %{
            "move" => move,
            "gameCode" => game_code,
            "positionId" => positionId
          }
        },
        socket
      ) do
    broadcast(socket, "shout", %{
      "type" => "pieceMoved",
      "payload" => %{
        "gameCode" => game_code,
        "position" => %{
          "positionId" => positionId <> "_new",
          "fen" => "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
          "ply" => 12
        },
        "move" => move,
        "variations" => []
      }
    })

    {:noreply, socket}
  end

  # It is also common to receive messages from the client and
  # broadcast to everyone in the current topic (room:lobby).
  @impl true
  def handle_in("shout", payload, socket) do
    broadcast(socket, "shout", payload)
    {:noreply, socket}
  end

  @impl true
  def handle_info(:after_join, socket) do
    {:ok, _} =
      Presence.track(socket, socket.assigns.user_id, %{
        user_id: socket.assigns.user_id
      })

    push(socket, "presence_state", Presence.list(socket))

    room = RoomServer.get_room(socket.assigns.room_code)

    room.game_codes
    |> Enum.each(fn game_code -> GameServer.start_link(game_code) end)

    room.game_codes
    |> Enum.map(fn game_code -> GameServer.get_game(game_code) end)
    |> Enum.map(fn game ->
      %{
        type: "gameAdded",
        payload: game |> Map.from_struct() |> Recase.Enumerable.convert_keys(&Recase.to_camel/1)
      }
    end)
    |> Enum.each(fn event -> push(socket, "shout", event) end)

    {:noreply, socket}
  end
end
