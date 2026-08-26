defmodule Blunderfest.Rooms do
  @moduledoc """
  Facade for room state (ADR-0012). Each room is its own `Blunderfest.Room`
  GenServer, registered by slug in a Horde Registry and started on demand
  under a Horde DynamicSupervisor on some node of the cluster (ADR-0013) —
  ops for different rooms never serialize through one process, and a room is
  reachable from every region. State is in-memory and rebuilt on boot, so a
  scale-to-zero instance loses nothing critical (ADR-0001).

  Ops are JSON-shaped maps (`%{"type" => ..., "payload" => ...}`) coming from
  channel payloads; the room process stamps them with `seq` and `ts`.

  All functions take an optional `scope` — a `{registry, supervisor}` pair —
  so tests can run isolated sets of rooms. The default scope uses the
  application-wide `Blunderfest.RoomRegistry` / `Blunderfest.RoomSupervisor`.

  ## Roles

  Each room has one `owner` (the first joiner, server-recorded) and a `roles`
  map of `profile_id => :owner | :collaborator | :viewer`. Only the owner can
  promote or demote other members to/from collaborator; everyone else is a viewer
  by default. Edit ops (`move_at_ply`, `set_game`, comments, arrows, ...) are
  reserved for owners and collaborators — and so is chat (ADR-0023): viewers
  read along but don't post. The owner alone can delete a chat message
  (`delete_chat` op naming the message's seq).

  Rooms created with `read_only: true` (the demo room, ADR-0014) record no
  members at all: nobody owns them and `can_edit?/3` is false for everyone.
  """

  alias Blunderfest.Room
  alias Blunderfest.RoomLog

  @type role :: :owner | :collaborator | :viewer
  @type op :: map()
  @typedoc "A `{registry, supervisor}` pair isolating a set of rooms."
  @type scope :: {atom(), atom()}

  # Growth cap: the number of rooms is bounded so a busy or
  # hostile instance can't grow memory without limit.
  @max_rooms 1_000

  # Room codes are 5 characters drawn from an unambiguous alphabet
  # (no i/l/o/0/1 to avoid reading errors when codes are exchanged).
  @code_regex ~r/^[abcdefghjkmnpqrstuvwxyz23456789]{5}$/

  @doc "The application-wide `{registry, supervisor}` scope."
  def default_scope, do: {Blunderfest.RoomRegistry, Blunderfest.RoomSupervisor}

  @doc "Room codes are exactly 5 characters from the canonical alphabet."
  def valid_code?(slug) do
    Regex.match?(@code_regex, slug)
  end

  @doc """
  Join approval policy: returns `:approved` or `:pending`.

  Every room is public today, so every join is approved automatically.
  Private rooms will later make this decision per room (e.g. consult the
  owner) instead of replying `:approved` unconditionally.
  """
  @spec approval_status(String.t(), String.t()) :: :approved | :pending
  def approval_status(slug, profile_id, scope \\ default_scope())

  def approval_status(_slug, _profile_id, _scope) do
    # Public rooms approve every join automatically. Private rooms will
    # consult room metadata (and the owner) here instead.
    :approved
  end

  @doc "Whether a room with `slug` exists (has a live room process)."
  def room_exists?(slug, scope \\ default_scope()) do
    lookup(slug, scope) != nil
  end

  @doc """
  Whether a room with `slug` has durable rows (ADR-0028) even though its
  process is gone — the join gate lets these revive: a join starts the
  room, which loads its log back instead of starting empty.
  """
  def persisted?(slug, _scope \\ default_scope()) do
    match?({:ok, _}, RoomLog.load(slug))
  end

  @doc "Whether the room is read-only (the demo room): false for unknown rooms."
  def read_only?(slug, scope \\ default_scope()) do
    with_pid(slug, scope, false, fn pid -> GenServer.call(pid, :read_only?) end)
  end

  @doc "The room's op log in append order (empty for unknown rooms)."
  def ops(slug, scope \\ default_scope()) do
    with_pid(slug, scope, [], fn pid -> GenServer.call(pid, :ops) end)
  end

  @doc """
  Explicitly creates a room. Joins never create rooms: a code that was not
  created here (or a room the server has lost) is rejected at join time.
  Idempotent — re-creating an existing slug keeps its state. The first
  profiled creator becomes the owner; anonymous creators are not recorded.
  `opts` is forwarded to the room process (`read_only: true` for the demo).
  """
  def create(slug, profile_id, scope \\ default_scope(), opts \\ []) do
    {registry, supervisor} = scope

    case lookup(slug, scope) do
      nil ->
        if Horde.Registry.count(registry) < @max_rooms do
          {:ok, pid} = do_start(slug, registry, supervisor, opts)
          GenServer.call(pid, {:register, profile_id})
        else
          {:error, :room_limit}
        end

      pid ->
        call_register(slug, scope, pid, profile_id)
    end
  end

  @doc """
  Appends `op` to the room's log, stamping it with `seq` and `ts`. Returns
  `{:ok, stamped_op}` or `{:error, :op_limit}` when the room is full.
  Materializes the room if needed (channel joins gate on `room_exists?/2`,
  so this only matters for internal callers and tests).

  No permission check — that's `submit_op/4`'s job; this is the trusted
  internal path (demo seeder, tests).
  """
  def append(slug, op, scope \\ default_scope()) do
    ensure_and_call(slug, scope, {:append, op})
  end

  @doc """
  Registers `profile_id` and returns everything a joining client needs —
  `%{ops, roles, read_only}` — in one atomic room call: one cross-node
  round trip instead of four (ADR-0013).
  """
  def join_snapshot(slug, profile_id, scope \\ default_scope()) do
    ensure_and_call(slug, scope, {:join, profile_id})
  end

  @doc """
  Checks and appends a client op as one atomic room call: read-only rooms
  reject everything with `:read_only`, edit ops from members without edit
  rights with `:forbidden`, appends beyond the cap with `:op_limit`. Doing
  it in the room process closes the check-then-append race (a demote can no
  longer slip between the permission check and the append) and costs one
  cross-node round trip instead of three (ADR-0013). `author_name` is the
  display-name snapshot for the durable mirror (ADR-0028).
  """
  def submit_op(slug, profile_id, op, scope \\ default_scope(), author_name \\ nil) do
    ensure_and_call(slug, scope, {:submit_op, profile_id, op, author_name})
  end

  @doc """
  Stops every room in the scope that has been idle (no joins, ops, or role
  changes) for at least `idle_ttl_ms` and for which `has_members?.(slug)` is
  false. Only rooms on the local node are considered — each cluster node
  sweeps its own (ADR-0013). Evicted rooms also lose their durable rows
  (ADR-0028: eviction is the purge path — a deploy's shutdown is not).
  Used by `BlunderfestWeb.RoomSweeper`.
  """
  def evict_idle(scope, idle_ttl_ms, has_members?) do
    {_registry, supervisor} = scope
    now = DateTime.utc_now()

    supervisor
    |> Horde.DynamicSupervisor.which_children()
    |> Enum.each(fn {_, pid, _, _} ->
      with true <- node(pid) == node(),
           {:ok, activity} <- room_activity(pid),
           true <- DateTime.diff(now, activity.last_active_at, :millisecond) >= idle_ttl_ms,
           false <- has_members?.(activity.slug) do
        RoomLog.delete(activity.slug)
        Horde.DynamicSupervisor.terminate_child(supervisor, pid)
      else
        _ -> :ok
      end
    end)

    :ok
  end

  @doc """
  Stops all room processes in the scope (test seam), purging their durable
  rows — the same semantics as eviction.
  """
  def reset(scope \\ default_scope()) do
    {registry, supervisor} = scope

    supervisor
    |> Horde.DynamicSupervisor.which_children()
    |> Enum.each(fn {_, pid, _, _} ->
      case room_activity(pid) do
        {:ok, activity} -> RoomLog.delete(activity.slug)
        :error -> :ok
      end

      Horde.DynamicSupervisor.terminate_child(supervisor, pid)
    end)

    # Registry cleanup lags behind the (synchronous) termination; wait for it
    # so the next lookup can't find a dead pid.
    wait_until_drained(registry)
    :ok
  end

  @doc """
  Registers `profile_id` in the room on join. The first profiled joiner of an
  empty room becomes its owner; everyone else is recorded as a viewer (unless
  already a collaborator/owner, so roles survive reconnects). Anonymous members are
  never recorded and can never own a room. Safe to call on every join.
  """
  def claim(slug, profile_id, scope \\ default_scope()) do
    ensure_and_call(slug, scope, {:register, profile_id})
  end

  def owner(slug, scope \\ default_scope()) do
    with_pid(slug, scope, nil, fn pid -> GenServer.call(pid, :owner) end)
  end

  @doc "The Fly region of the node hosting the room process (nil for unknown rooms)."
  def region(slug, scope \\ default_scope()) do
    with_pid(slug, scope, nil, fn pid -> GenServer.call(pid, :region) end)
  end

  @doc "Returns the room's `profile_id => role` map (empty for unknown rooms)."
  def roles(slug, scope \\ default_scope()) do
    with_pid(slug, scope, %{}, fn pid -> GenServer.call(pid, :roles) end)
  end

  def role_for(slug, profile_id, scope \\ default_scope()) do
    with_pid(slug, scope, :viewer, fn pid -> GenServer.call(pid, {:role_for, profile_id}) end)
  end

  @doc """
  Sets `member_id`'s role to `role` (`:collaborator` or `:viewer`). Only the room's
  owner may do this, and the owner's own role can't be changed. Returns
  `{:ok, role}` or `{:error, :forbidden | :invalid_role | :invalid_member}`.
  """
  def set_role(slug, actor_id, member_id, role, scope \\ default_scope())

  def set_role(slug, actor_id, member_id, role, scope) when role in [:collaborator, :viewer] do
    case lookup(slug, scope) do
      nil -> {:error, :forbidden}
      pid -> GenServer.call(pid, {:set_role, actor_id, member_id, role})
    end
  end

  def set_role(_slug, _actor_id, _member_id, _role, _scope), do: {:error, :invalid_role}

  @doc """
  Hands presenting to `member_id` (any recorded member) or back to the owner
  (`member_id` equal to the owner or nil). Only the room's owner may do this.
  Returns `{:ok, presenter_id}` or `{:error, :forbidden | :invalid_member}`.
  """
  def set_presenter(slug, actor_id, member_id, scope \\ default_scope()) do
    case lookup(slug, scope) do
      nil -> {:error, :forbidden}
      pid -> GenServer.call(pid, {:set_presenter, actor_id, member_id})
    end
  end

  @doc "Whether `profile_id` may push edit ops in this room (owner or collaborator)."
  def can_edit?(slug, profile_id, scope \\ default_scope()) do
    with_pid(slug, scope, false, fn pid -> GenServer.call(pid, {:can_edit?, profile_id}) end)
  end

  defp room_activity(pid) do
    {:ok, GenServer.call(pid, :activity)}
  catch
    # The room died between listing and the call.
    :exit, _ -> :error
  end

  defp call_register(slug, scope, pid, profile_id) do
    GenServer.call(pid, {:register, profile_id})
  catch
    # The room died between lookup and call; start fresh and register there.
    :exit, _ -> ensure_and_call(slug, scope, {:register, profile_id})
  end

  defp with_pid(slug, scope, default, fun) do
    case lookup(slug, scope) do
      nil ->
        default

      pid ->
        try do
          fun.(pid)
        catch
          # The room died between lookup and call (crash or reset).
          :exit, _ -> default
        end
    end
  end

  defp ensure_and_call(slug, scope, message) do
    {:ok, pid} = ensure_room(slug, scope)

    try do
      GenServer.call(pid, message)
    catch
      # The room died between lookup and call; start fresh and try once more
      # (by now the registry has dropped the dead pid).
      :exit, _ ->
        {:ok, pid} = ensure_room(slug, scope)
        GenServer.call(pid, message)
    end
  end

  defp wait_until_drained(registry, attempts \\ 50)
  defp wait_until_drained(_registry, 0), do: :ok

  defp wait_until_drained(registry, attempts) do
    if Horde.Registry.count(registry) == 0 do
      :ok
    else
      Process.sleep(10)
      wait_until_drained(registry, attempts - 1)
    end
  end

  defp lookup(slug, {registry, _supervisor}) do
    case Horde.Registry.lookup(registry, slug) do
      [{pid, _}] -> pid
      [] -> nil
    end
  end

  defp ensure_room(slug, {registry, supervisor} = scope) do
    case lookup(slug, scope) do
      nil -> do_start(slug, registry, supervisor, [])
      pid -> {:ok, pid}
    end
  end

  defp do_start(slug, registry, supervisor, opts) do
    case Horde.DynamicSupervisor.start_child(supervisor, {Room, {registry, slug, opts}}) do
      {:ok, pid} -> {:ok, pid}
      {:error, {:already_started, pid}} -> {:ok, pid}
    end
  end
end
