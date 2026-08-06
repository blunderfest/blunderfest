defmodule Blunderfest.Rooms do
  @moduledoc """
  In-memory room state: the op log plus membership roles. The authoritative
  state of a room is its operation log (`ops`): a monotonically increasing
  `seq` per room. State is rebuilt on boot, so a scale-to-zero instance loses
  nothing critical.

  Ops are JSON-shaped maps (`%{"type" => ..., "payload" => ...}`) coming from
  channel payloads; the store stamps them with `seq` and `ts`.

  ## Roles

  Each room has one `owner` (the first joiner, server-recorded) and a `roles`
  map of `profile_id => :owner | :collaborator | :viewer`. Only the owner can
  promote or demote other members to/from collaborator; everyone else is a viewer
  by default. Edit ops (`move_at_ply`, `set_game`, comments, arrows, ...) are
  reserved for owners and collaborators.
  """

  use GenServer

  @type role :: :owner | :collaborator | :viewer
  @type op :: map()

  @edit_op_types ~w(set_game move_at_ply replace_line comment_at_ply add_arrow add_highlight)

  def start_link(opts) do
    GenServer.start_link(__MODULE__, %{}, name: Keyword.get(opts, :name, __MODULE__))
  end

  def ops(slug, server \\ __MODULE__) do
    GenServer.call(server, {:ops, slug})
  end

  def append(slug, op, server \\ __MODULE__) do
    GenServer.call(server, {:append, slug, op})
  end

  def reset(server \\ __MODULE__) do
    GenServer.call(server, :reset)
  end

  @doc """
  Registers `profile_id` in the room on join. The first profiled joiner of an
  empty room becomes its owner; everyone else is recorded as a viewer (unless
  already a collaborator/owner, so roles survive reconnects). Anonymous members are
  never recorded and can never own a room. Safe to call on every join.
  """
  def claim(slug, profile_id, server \\ __MODULE__) do
    GenServer.call(server, {:claim, slug, profile_id})
  end

  def owner(slug, server \\ __MODULE__) do
    GenServer.call(server, {:owner, slug})
  end

  @doc "Returns the room's `profile_id => role` map (empty for unknown rooms)."
  def roles(slug, server \\ __MODULE__) do
    GenServer.call(server, {:roles, slug})
  end

  def role_for(slug, profile_id, server \\ __MODULE__) do
    GenServer.call(server, {:role_for, slug, profile_id})
  end

  @doc """
  Sets `member_id`'s role to `role` (`:collaborator` or `:viewer`). Only the room's
  owner may do this, and the owner's own role can't be changed. Returns
  `{:ok, role}` or `{:error, :forbidden | :invalid_role | :invalid_member}`.
  """
  def set_role(slug, actor_id, member_id, role, server \\ __MODULE__)

  def set_role(slug, actor_id, member_id, role, server) when role in [:collaborator, :viewer] do
    GenServer.call(server, {:set_role, slug, actor_id, member_id, role})
  end

  def set_role(_slug, _actor_id, _member_id, _role, _server), do: {:error, :invalid_role}

  @doc "Whether `profile_id` may push edit ops in this room (owner or collaborator)."
  def can_edit?(slug, profile_id, server \\ __MODULE__) do
    GenServer.call(server, {:can_edit?, slug, profile_id})
  end

  @doc "Whether an op payload counts as a room edit (moves, comments, etc.)."
  def edit_op?(%{"type" => type}) when type in @edit_op_types, do: true
  def edit_op?(%{"type" => type}) when is_binary(type), do: false
  def edit_op?(op) when is_map(op), do: op["type"] in @edit_op_types
  def edit_op?(_op), do: false

  @impl true
  def init(_args) do
    {:ok, %{}}
  end

  @impl true
  def handle_call({:ops, slug}, _from, state) do
    {:reply, Map.get(state, slug, empty_room()).ops, state}
  end

  def handle_call({:append, slug, op}, _from, state) do
    room = Map.get(state, slug, empty_room())
    op = Map.merge(op, %{"seq" => room.seq + 1, "ts" => DateTime.utc_now()})
    room = %{room | seq: room.seq + 1, ops: room.ops ++ [op]}
    {:reply, op, Map.put(state, slug, room)}
  end

  def handle_call({:claim, slug, profile_id}, _from, state) do
    room = Map.get(state, slug, empty_room())

    room =
      cond do
        profile_id == "anonymous" or Map.has_key?(room.roles, profile_id) ->
          room

        room.owner == nil ->
          %{room | owner: profile_id, roles: Map.put(room.roles, profile_id, :owner)}

        true ->
          %{room | roles: Map.put(room.roles, profile_id, :viewer)}
      end

    {:reply, :ok, Map.put(state, slug, room)}
  end

  def handle_call({:owner, slug}, _from, state) do
    {:reply, Map.get(state, slug, empty_room()).owner, state}
  end

  def handle_call({:roles, slug}, _from, state) do
    {:reply, Map.get(state, slug, empty_room()).roles, state}
  end

  def handle_call({:role_for, slug, profile_id}, _from, state) do
    room = Map.get(state, slug, empty_room())
    {:reply, Map.get(room.roles, profile_id, :viewer), state}
  end

  def handle_call({:set_role, slug, actor_id, member_id, role}, _from, state) do
    room = Map.get(state, slug, empty_room())

    cond do
      room.owner != actor_id ->
        {:reply, {:error, :forbidden}, state}

      member_id == room.owner or member_id == "anonymous" ->
        {:reply, {:error, :invalid_member}, state}

      true ->
        room = %{room | roles: Map.put(room.roles, member_id, role)}
        {:reply, {:ok, role}, Map.put(state, slug, room)}
    end
  end

  def handle_call({:can_edit?, slug, profile_id}, _from, state) do
    room = Map.get(state, slug, empty_room())
    {:reply, Map.get(room.roles, profile_id, :viewer) in [:owner, :collaborator], state}
  end

  def handle_call(:reset, _from, _state) do
    {:reply, :ok, %{}}
  end

  defp empty_room do
    %{seq: 0, ops: [], owner: nil, roles: %{}}
  end
end
