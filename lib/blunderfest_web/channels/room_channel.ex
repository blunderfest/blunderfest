defmodule BlunderfestWeb.RoomChannel do
  @moduledoc """
  One channel per room slug: `room:<slug>`.

  - **Join** replies with the room's op log (`%{ops: [...]}`) and role map
    (`%{roles: %{"profile-1" => "owner", ...}}`); clients replay ops.
  - **Presence** tracks who's in the room (by optional profile id, else
    `"anonymous"`); diffs are broadcast automatically.
  - **`op` pushes** are validated (`Blunderfest.Ops`), then permission-checked
    and appended atomically by the room process (`Rooms.submit_op/3`), stamped
    with `seq`/`ts`/`author`, and broadcast back to *everyone*, including the
    sender — the echoed op is the single application path on clients, so no
    local double-apply. Edit ops (moves, comments, arrows, game imports) are
    rejected for viewers.
  - **`set_role` pushes** let the room owner promote/demote other members;
    the new role is broadcast to everyone as `role_update`.

  The demo room (ADR-0014) is re-seeded on demand at join, so it survives
  room-process and node loss; it is read-only: no presence is tracked and
  every op push is rejected with `:read_only`.
  """

  use BlunderfestWeb, :channel

  alias Blunderfest.{DemoRoom, GameAnalysis, Ops, Profiles, Rooms}

  @impl true
  def join("room:" <> slug, params, socket) do
    # Seed the demo room on demand (ADR-0014): a boot-time-only seed would
    # 404 as soon as the room process or its node is lost. Idempotent.
    if DemoRoom.reserved?(slug), do: DemoRoom.seed()

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

    # One atomic room call: claims membership and returns the replay state.
    snapshot = Rooms.join_snapshot(slug, profile_id)

    socket =
      socket
      |> assign(:slug, slug)
      |> assign(:profile_id, profile_id)
      |> assign(:profile_name, profile_name_for(profile_id, params["name"]))
      |> assign(:read_only, snapshot.read_only)

    send(self(), :after_join)

    {:ok,
     %{
       ops: snapshot.ops,
       roles: stringify_roles(snapshot.roles),
       region: Blunderfest.NodeInfo.region(),
       room_region: Rooms.region(slug),
       read_only: snapshot.read_only
     }, socket}
  end

  @impl true
  def handle_info(:after_join, socket) do
    # Read-only rooms track no presence: demo visitors don't see each other.
    unless socket.assigns.read_only do
      BlunderfestWeb.Presence.track(self(), socket.topic, socket.assigns.profile_id, %{
        name: socket.assigns.profile_name
      })

      # Phoenix does not send the current presence state to a joining client
      # automatically; the joining client must push it itself after tracking.
      push(socket, "presence_state", BlunderfestWeb.Presence.list(socket.topic))
    end

    {:noreply, socket}
  end

  # A trivial round-trip probe for the client's lag measurement.
  @impl true
  def handle_in("ping", _params, socket) do
    {:reply, :ok, socket}
  end

  @impl true
  def handle_in("op", op, socket) do
    with :ok <- Ops.validate(op),
         {:ok, op} <- submit_op(op, socket) do
      broadcast!(socket, "new_op", op)
      {:reply, :ok, socket}
    else
      {:error, reason} -> {:reply, {:error, %{reason: reason}}, socket}
    end
  end

  # A whole-game analysis request: editors only. The job evals each mainline
  # position on the engine pool and appends a `set_analysis` op when done.
  @impl true
  def handle_in("analyze_game", %{"game_id" => game_id, "positions" => positions}, socket) do
    with :ok <- check_can_edit(socket),
         {:ok, positions} <- validate_positions(positions),
         :ok <- GameAnalysis.start(socket.assigns.slug, game_id, positions) do
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

  # The room process permission-checks and appends atomically: a demote can
  # no longer slip between check and append, and an op costs one cross-node
  # round trip instead of three (ADR-0013).
  defp submit_op(op, socket) do
    op = Map.merge(op, %{"author" => socket.assigns.profile_id})
    Rooms.submit_op(socket.assigns.slug, socket.assigns.profile_id, op)
  end

  defp check_can_edit(socket) do
    if Rooms.can_edit?(socket.assigns.slug, socket.assigns.profile_id) do
      :ok
    else
      {:error, :forbidden}
    end
  end

  # [{ply, fen}] for the analysis job: bounded, shaped.
  defp validate_positions(positions) when is_list(positions) and length(positions) <= 200 do
    if Enum.all?(positions, &valid_position?/1) do
      {:ok, Enum.map(positions, fn %{"ply" => ply, "fen" => fen} -> {ply, fen} end)}
    else
      {:error, :invalid_request}
    end
  end

  defp validate_positions(_), do: {:error, :invalid_request}

  defp valid_position?(%{"ply" => ply, "fen" => fen}) do
    is_integer(ply) and ply >= 0 and is_binary(fen) and byte_size(fen) <= 128
  end

  defp valid_position?(_), do: false

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
