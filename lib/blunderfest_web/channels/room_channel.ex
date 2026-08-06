defmodule BlunderfestWeb.RoomChannel do
  @moduledoc """
  One channel per room slug: `room:<slug>`.

  - **Join** replies with the room's op log (`%{ops: [...]}`) and role map
    (`%{roles: %{"profile-1" => "owner", ...}}`); clients replay ops.
  - **Presence** tracks who's in the room (by optional profile id, else
    `"anonymous"`); diffs are broadcast automatically.
  - **`op` pushes** are stamped with `seq`/`ts`/`author` by `Blunderfest.Rooms`
    and broadcast back to *everyone*, including the sender — the echoed op is
    the single application path on clients, so no local double-apply. Edit ops
    (moves, comments, arrows, game imports) are rejected for viewers.
  - **`set_role` pushes** let the room owner promote/demote other members;
    the new role is broadcast to everyone as `role_update`.
  """

  use BlunderfestWeb, :channel

  alias Blunderfest.Rooms

  @impl true
  def join("room:" <> slug, params, socket) do
    profile_id = params["profile_id"] || "anonymous"

    Rooms.claim(slug, profile_id)

    socket =
      socket
      |> assign(:slug, slug)
      |> assign(:profile_id, profile_id)
      |> assign(:profile_name, params["name"] || "Anonymous")

    send(self(), :after_join)

    {:ok, %{ops: Rooms.ops(slug), roles: stringify_roles(Rooms.roles(slug))}, socket}
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
    if Rooms.edit_op?(op) and not Rooms.can_edit?(socket.assigns.slug, socket.assigns.profile_id) do
      {:reply, {:error, %{reason: :forbidden}}, socket}
    else
      op = Map.merge(op, %{"author" => socket.assigns.profile_id})
      op = Rooms.append(socket.assigns.slug, op)
      broadcast!(socket, "new_op", op)
      {:reply, :ok, socket}
    end
  end

  @impl true
  def handle_in("set_role", %{"member_id" => member_id, "role" => role}, socket) do
    case Rooms.set_role(
           socket.assigns.slug,
           socket.assigns.profile_id,
           member_id,
           string_to_role(role)
         ) do
      {:ok, role} ->
        broadcast!(socket, "role_update", %{"member_id" => member_id, "role" => to_string(role)})
        {:reply, :ok, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: reason}}, socket}
    end
  end

  defp string_to_role("partner"), do: :partner
  defp string_to_role("viewer"), do: :viewer
  defp string_to_role(_role), do: :unknown

  defp stringify_roles(roles) do
    Map.new(roles, fn {profile_id, role} -> {profile_id, to_string(role)} end)
  end
end
