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

  # Growth cap (REVIEW.md #3): a busy or hostile room can't grow without
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
       roles: %{},
       read_only: Keyword.get(opts, :read_only, false)
     }}
  end

  @impl true
  def handle_call(:ops, _from, room) do
    {:reply, Enum.reverse(room.ops), room}
  end

  def handle_call({:register, profile_id}, _from, room) do
    {:reply, :ok, register_member(room, profile_id)}
  end

  def handle_call({:join, profile_id}, _from, room) do
    room = register_member(room, profile_id)

    reply = %{
      ops: Enum.reverse(room.ops),
      roles: room.roles,
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
        {:reply, {:ok, role}, %{room | roles: Map.put(room.roles, member_id, role)}}
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
      op = Map.merge(op, %{"seq" => room.seq + 1, "ts" => DateTime.utc_now()})
      room = %{room | seq: room.seq + 1, op_count: room.op_count + 1, ops: [op | room.ops]}
      {:ok, op, room}
    end
  end
end
