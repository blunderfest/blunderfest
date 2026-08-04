defmodule BlunderfestWeb.RoomChannel do
  @moduledoc """
  One channel per room slug: `room:<slug>`.

  - **Join** replies with the room's op log (`%{ops: [...]}`); clients replay it.
  - **Presence** tracks who's in the room (by optional profile id, else
    `"anonymous"`); diffs are broadcast automatically.
  - **`op` pushes** are stamped with `seq`/`ts`/`author` by `Blunderfest.Rooms`
    and broadcast back to *everyone*, including the sender — the echoed op is
    the single application path on clients, so no local double-apply.
  """

  use BlunderfestWeb, :channel

  alias Blunderfest.Rooms

  @impl true
  def join("room:" <> slug, params, socket) do
    socket =
      socket
      |> assign(:slug, slug)
      |> assign(:profile_id, params["profile_id"] || "anonymous")
      |> assign(:profile_name, params["name"] || "Anonymous")

    send(self(), :after_join)

    {:ok, %{ops: Rooms.ops(slug)}, socket}
  end

  @impl true
  def handle_info(:after_join, socket) do
    BlunderfestWeb.Presence.track(self(), socket.topic, socket.assigns.profile_id, %{
      name: socket.assigns.profile_name
    })

    {:noreply, socket}
  end

  @impl true
  def handle_in("op", op, socket) do
    op = Map.merge(op, %{"author" => socket.assigns.profile_id})
    op = Rooms.append(socket.assigns.slug, op)
    broadcast!(socket, "new_op", op)
    {:reply, :ok, socket}
  end
end
