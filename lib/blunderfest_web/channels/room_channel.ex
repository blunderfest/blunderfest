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

  alias Blunderfest.{Ops, Profiles, Rooms}

  @impl true
  def join("room:" <> slug, params, socket) do
    cond do
      not Rooms.valid_code?(slug) ->
        {:error, %{reason: :invalid_code}}

      not Rooms.room_exists?(slug) ->
        # Joins never create rooms; only the create endpoint does.
        {:error, %{reason: :room_not_found}}

      true ->
        approve_join(slug, params, socket)
    end
  end

  defp approve_join(slug, params, socket) do
    profile_id = params["profile_id"] || "anonymous"

    # Every room is public today, so approval_status/2 always approves. For
    # private rooms this becomes a case on its `:pending` verdict: reply
    # `%{status: "pending"}`, skip presence/op replay, and wait for an
    # explicit approval push. The seam is the call, not a dead branch.
    :approved = Rooms.approval_status(slug, profile_id)

    Rooms.claim(slug, profile_id)

    socket =
      socket
      |> assign(:slug, slug)
      |> assign(:profile_id, profile_id)
      |> assign(:profile_name, profile_name_for(profile_id, params["name"]))

    send(self(), :after_join)

    {:ok,
     %{
       ops: Rooms.ops(slug),
       roles: stringify_roles(Rooms.roles(slug)),
       region: Blunderfest.NodeInfo.region()
     }, socket}
  end

  @impl true
  def handle_info(:after_join, socket) do
    BlunderfestWeb.Presence.track(self(), socket.topic, socket.assigns.profile_id, %{
      name: socket.assigns.profile_name
    })

    # Phoenix does not send the current presence state to a joining client
    # automatically; the joining client must push it itself after tracking.
    push(socket, "presence_state", BlunderfestWeb.Presence.list(socket.topic))

    {:noreply, socket}
  end

  @impl true
  def handle_in("op", op, socket) do
    with :ok <- Ops.validate(op),
         :ok <- check_edit_permission(op, socket),
         {:ok, op} <- append_op(op, socket) do
      broadcast!(socket, "new_op", op)
      {:reply, :ok, socket}
    else
      {:error, reason} -> {:reply, {:error, %{reason: reason}}, socket}
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

  defp append_op(op, socket) do
    op = Map.merge(op, %{"author" => socket.assigns.profile_id})
    Rooms.append(socket.assigns.slug, op)
  end

  defp check_edit_permission(op, socket) do
    if Rooms.edit_op?(op) and not Rooms.can_edit?(socket.assigns.slug, socket.assigns.profile_id) do
      {:error, :forbidden}
    else
      :ok
    end
  end

  defp string_to_role("collaborator"), do: :collaborator
  defp string_to_role("viewer"), do: :viewer
  defp string_to_role(_role), do: :unknown

  defp profile_name_for(profile_id, fallback) do
    case Profiles.get(profile_id) do
      {:ok, profile} -> profile.name
      :error -> fallback || "Anonymous"
    end
  end

  defp stringify_roles(roles) do
    Map.new(roles, fn {profile_id, role} -> {profile_id, to_string(role)} end)
  end
end
