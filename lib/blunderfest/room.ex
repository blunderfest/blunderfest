defmodule Blunderfest.Room do
  @moduledoc """
  One process per room (ADR-0012): holds the room's op log and membership
  roles. Started on demand by `Blunderfest.Rooms` under a DynamicSupervisor
  and registered by slug in a Registry, so activity in one room never
  serializes behind another.

  Ops are stored prepended (newest first) with a separate `op_count`, so
  appends and the growth-cap check are O(1); reads reverse. `:temporary` —
  a crashed room is a lost room, which matches the no-DB stance: a
  scale-to-zero instance loses all rooms anyway (ADR-0001).

  A room created with `read_only: true` (the demo room, ADR-0014) records
  no members at all: nobody owns it and nobody gains edit rights.
  """

  use GenServer, restart: :temporary

  alias Blunderfest.Ops

  # Growth cap: a busy or hostile room can't grow without
  # limit; appends beyond the cap are rejected with `{:error, :op_limit}`.
  @max_ops_per_room 5_000

  def start_link({registry, slug, opts}) do
    GenServer.start_link(__MODULE__, {slug, opts}, name: {:via, Horde.Registry, {registry, slug}})
  end

  @impl true
  def init({slug, opts}) do
    {:ok,
     %{
       slug: slug,
       seq: 0,
       op_count: 0,
       ops: [],
       owner: nil,
       presenter: nil,
       roles: %{},
       read_only: Keyword.get(opts, :read_only, false),
       last_active_at: DateTime.utc_now()
     }}
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
    case append_op(room, op) do
      {:ok, op, room} -> {:reply, {:ok, op}, room}
      {:error, reason} -> {:reply, {:error, reason}, room}
    end
  end

  def handle_call({:submit_op, profile_id, op}, _from, room) do
    cond do
      room.read_only ->
        {:reply, {:error, :read_only}, room}

      Ops.edit_op?(op) and not can_edit?(room, profile_id) ->
        {:reply, {:error, :forbidden}, room}

      true ->
        case append_op(room, op) do
          {:ok, op, room} -> {:reply, {:ok, op}, room}
          {:error, reason} -> {:reply, {:error, reason}, room}
        end
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
        {:reply, {:ok, role}, touch(%{room | roles: Map.put(room.roles, member_id, role)})}
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

  defp append_op(room, op) do
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

      {:ok, op, room}
    end
  end

  defp touch(room), do: %{room | last_active_at: DateTime.utc_now()}
end
