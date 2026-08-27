defmodule Blunderfest.Room do
  @moduledoc """
  One process per room (ADR-0012): holds the room's op log and membership
  roles. Started on demand by `Blunderfest.Rooms` under a DynamicSupervisor
  and registered by slug in a Registry, so activity in one room never
  serializes behind another.

  Ops are stored prepended (newest first) with a separate `op_count`, so
  appends and the growth-cap check are O(1); reads reverse.

  Since ADR-0028 the log has a durable mirror: every non-cursor op is
  written through to `Blunderfest.RoomLog` (with an author-name snapshot)
  as it is appended, roles are persisted on change, and a room process
  starting for a known slug loads its log, roles, and activity time back
  before serving joins — a deploy kills the process, not the room. The
  read-only demo room (ADR-0014) is never persisted, and eviction purges
  a room's durable rows (deletion lives in the sweeper path, not in
  `terminate/2`: a deploy's shutdown must not delete rooms).
  """

  use GenServer, restart: :temporary

  alias Blunderfest.DemoRoom
  alias Blunderfest.Ops
  alias Blunderfest.RoomLog

  # Growth cap: a busy or hostile room can't grow without
  # limit; appends beyond the cap are rejected with `{:error, :op_limit}`.
  @max_ops_per_room 5_000

  def start_link({registry, slug, opts}) do
    GenServer.start_link(__MODULE__, {slug, opts}, name: {:via, Horde.Registry, {registry, slug}})
  end

  @impl true
  def init({slug, opts}) do
    # The reserved demo slug is read-only no matter how the process was
    # started (ADR-0014): the seed passes the flag, but a registry-race
    # restart (the seed's existence check observes a zombie entry and skips
    # creation; the join's ensure_room then restarts with default opts) must
    # not produce a writable demo room. The slug decides, not the caller.
    read_only = DemoRoom.reserved?(slug) or Keyword.get(opts, :read_only, false)

    room =
      if read_only do
        empty_room(slug, read_only: true)
      else
        load_durable(slug)
      end

    {:ok, room}
  end

  # The durable mirror of the room: ops (ascending), roles, activity time.
  # Absent or unconfigured storage falls back to an empty room — the
  # in-memory stance (ADR-0001) still holds when there is nothing to load.
  defp load_durable(slug) do
    case RoomLog.load(slug) do
      {:ok, %{ops: ops, roles: roles, last_active_at: last_active_at}} ->
        seq =
          ops
          |> List.last()
          |> case do
            nil -> 0
            op -> op["seq"]
          end

        owner = Enum.find(Map.keys(roles), &(Map.get(roles, &1) == :owner))

        %{
          slug: slug,
          seq: seq,
          op_count: length(ops),
          ops: Enum.reverse(ops),
          owner: owner,
          presenter: nil,
          roles: roles,
          read_only: false,
          last_active_at: last_active_at
        }

      _ ->
        empty_room(slug, read_only: false)
    end
  end

  defp empty_room(slug, read_only: read_only) do
    %{
      slug: slug,
      seq: 0,
      op_count: 0,
      ops: [],
      owner: nil,
      presenter: nil,
      roles: %{},
      read_only: read_only,
      last_active_at: DateTime.utc_now()
    }
  end

  @impl true
  def handle_call(:ops, _from, room) do
    {:reply, Enum.reverse(room.ops), room}
  end

  def handle_call(:activity, _from, room) do
    {:reply, %{slug: room.slug, last_active_at: room.last_active_at}, room}
  end

  def handle_call({:register, profile_id}, _from, room) do
    {:reply, :ok, room |> register_member(profile_id) |> touch()}
  end

  def handle_call({:join, profile_id}, _from, room) do
    room = room |> register_member(profile_id) |> touch()

    reply = %{
      ops: Enum.reverse(room.ops),
      roles: room.roles,
      presenter: room.presenter,
      read_only: room.read_only
    }

    {:reply, reply, room}
  end

  def handle_call({:append, op}, _from, room) do
    case append_op(room, op, nil) do
      {:ok, op, room} -> {:reply, {:ok, op}, room}
      {:error, reason} -> {:reply, {:error, reason}, room}
    end
  end

  def handle_call({:submit_op, profile_id, op, author_name}, _from, room) do
    case check_op(room, profile_id, op) do
      :ok ->
        case append_op(room, op, author_name) do
          {:ok, op, room} -> {:reply, {:ok, op}, room}
          {:error, reason} -> {:reply, {:error, reason}, room}
        end

      {:error, reason} ->
        {:reply, {:error, reason}, room}
    end
  end

  def handle_call(:read_only?, _from, room) do
    {:reply, room.read_only, room}
  end

  def handle_call(:owner, _from, room) do
    {:reply, room.owner, room}
  end

  # Evaluated on the room's node: its Fly region (for the you-vs-room split).
  def handle_call(:region, _from, room) do
    {:reply, Blunderfest.NodeInfo.region(), room}
  end

  def handle_call(:roles, _from, room) do
    {:reply, room.roles, room}
  end

  def handle_call({:role_for, profile_id}, _from, room) do
    {:reply, Map.get(room.roles, profile_id, :viewer), room}
  end

  def handle_call({:can_edit?, profile_id}, _from, room) do
    {:reply, can_edit?(room, profile_id), room}
  end

  def handle_call({:set_role, actor_id, member_id, role}, _from, room) do
    cond do
      room.owner != actor_id ->
        {:reply, {:error, :forbidden}, room}

      member_id == room.owner or member_id == "anonymous" ->
        {:reply, {:error, :invalid_member}, room}

      true ->
        room = touch(%{room | roles: Map.put(room.roles, member_id, role)})
        persist_roles(room)
        {:reply, {:ok, role}, room}
    end
  end

  # Presenting handoff (ADR-0021): the owner may pass the mic to any recorded
  # member, or back to themselves (member_id == owner or nil). Presenting
  # still derives from presence — an absent presenter yields the floor back
  # to the owner until they return.
  def handle_call({:set_presenter, actor_id, member_id}, _from, room) do
    cond do
      room.owner != actor_id ->
        {:reply, {:error, :forbidden}, room}

      member_id == "anonymous" or
          (member_id != nil and not Map.has_key?(room.roles, member_id)) ->
        {:reply, {:error, :invalid_member}, room}

      true ->
        presenter = if member_id == room.owner, do: nil, else: member_id
        {:reply, {:ok, presenter}, touch(%{room | presenter: presenter})}
    end
  end

  defp register_member(room, profile_id) do
    cond do
      # Read-only rooms (the demo) record nobody: no owner, no roles.
      room.read_only ->
        room

      profile_id == "anonymous" or Map.has_key?(room.roles, profile_id) ->
        room

      room.owner == nil ->
        %{room | owner: profile_id, roles: Map.put(room.roles, profile_id, :owner)}

      true ->
        %{room | roles: Map.put(room.roles, profile_id, :viewer)}
    end
  end

  defp can_edit?(room, profile_id) do
    Map.get(room.roles, profile_id, :viewer) in [:owner, :collaborator]
  end

  # Permission check for a client op, run in the room process so check and
  # append are atomic. Edit ops need edit rights; chat (ADR-0023) needs them
  # too — viewers watch, they don't post; `delete_chat` is the owner's
  # moderation tool and must name the seq of an actual chat op.
  defp check_op(room, profile_id, op) do
    cond do
      room.read_only ->
        {:error, :read_only}

      Ops.edit_op?(op) and not can_edit?(room, profile_id) ->
        {:error, :forbidden}

      op["type"] == "chat" and not can_edit?(room, profile_id) ->
        {:error, :forbidden}

      op["type"] == "delete_chat" ->
        check_delete_chat(room, profile_id, op)

      true ->
        :ok
    end
  end

  defp check_delete_chat(room, profile_id, op) do
    cond do
      room.owner != profile_id -> {:error, :forbidden}
      chat_seq?(room, op["payload"]["seq"]) -> :ok
      true -> {:error, :invalid_op}
    end
  end

  defp chat_seq?(room, seq) do
    Enum.any?(room.ops, fn op -> op["type"] == "chat" and op["seq"] == seq end)
  end

  defp append_op(room, op, author_name) do
    if room.op_count >= @max_ops_per_room do
      {:error, :op_limit}
    else
      now = DateTime.utc_now()
      op = Map.merge(op, %{"seq" => room.seq + 1, "ts" => now})

      room = %{
        room
        | seq: room.seq + 1,
          op_count: room.op_count + 1,
          ops: [op | room.ops],
          last_active_at: now
      }

      # The durable mirror (ADR-0028): everything but the cursor noise and
      # the read-only demo room. Best-effort — the in-memory log stays
      # authoritative.
      unless room.read_only or op["type"] == "set_cursor" do
        RoomLog.append(room.slug, op, author_name)
      end

      {:ok, op, room}
    end
  end

  defp persist_roles(%{read_only: true}), do: :ok

  defp persist_roles(room) do
    RoomLog.put_roles(room.slug, room.roles)
  end

  defp touch(room), do: %{room | last_active_at: DateTime.utc_now()}
end
