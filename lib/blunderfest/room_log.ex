defmodule Blunderfest.RoomLog do
  @moduledoc """
  The durable room-log boundary (ADR-0028): the one place application code
  touches the persisted copy of rooms' op logs.

  Rooms stay in-memory (ADR-0001, ADR-0005) — this is a write-through
  mirror that survives deploys: every non-cursor op is appended here as
  the room appends it, with an `author_name` snapshot, and a room process
  that starts after a restart reloads its log, roles, and activity time
  from here instead of starting empty. The sweepers purge: eviction
  deletes the rows with the room, and a backstop removes rows orphaned by
  a machine restart that nobody re-joins within the ADR-0016 window.

  `set_cursor` ops never reach this store (the room filters them); the
  read-only demo room is never persisted either. When no `db:` config
  exists the process starts unconfigured: every call is a no-op and
  loads report `{:error, :not_configured}` — rooms stay memory-only.

  The schema is two tables, created idempotently on start:

      room_logs(slug, roles jsonb, last_active_at timestamptz)
      room_ops(slug, seq, type, payload jsonb, author, author_name, ts)
  """

  use GenServer

  alias Blunderfest.RoomLog.Store

  @max_ops_per_room 5_000

  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  ## API

  @doc "Whether a database is configured (ADR-0028 graceful absence)."
  @spec configured?() :: boolean()
  def configured?, do: GenServer.call(__MODULE__, :configured?)

  @doc """
  Appends a stamped op (`seq`, `type`, `payload`, `author`, `ts`) to the
  durable log, with the author's display-name snapshot. Async and
  best-effort: the in-memory room is authoritative, a failed write is
  logged, never raised. No-op when unconfigured.
  """
  @spec append(String.t(), map(), String.t() | nil) :: :ok
  def append(slug, op, author_name) do
    GenServer.cast(__MODULE__, {:append, slug, op, author_name})
  end

  @doc """
  Persists the room's roles map (atom-keyed at the caller; stored as
  JSON). Async, best-effort, no-op when unconfigured.
  """
  @spec put_roles(String.t(), map()) :: :ok
  def put_roles(slug, roles) do
    GenServer.cast(__MODULE__, {:put_roles, slug, roles})
  end

  @doc """
  Loads the durable room: its ops in ascending seq order (each with the
  stored `author_name`), its roles (atom-keyed), and its last activity
  time. Returns `:not_found` for unknown slugs, `{:error, :not_configured}`
  without a database.
  """
  @spec load(String.t()) ::
          {:ok, %{ops: [map()], roles: map(), last_active_at: DateTime.t()}}
          | :not_found
          | {:error, :not_configured}
  def load(slug) do
    GenServer.call(__MODULE__, {:load, slug}, :infinity)
  end

  @doc """
  Purges a room's durable rows (eviction). Async, idempotent, no-op when
  unconfigured.
  """
  @spec delete(String.t()) :: :ok
  def delete(slug) do
    GenServer.cast(__MODULE__, {:delete, slug})
  end

  @doc """
  Slugs whose durable rows are older than `older_than_ms` — the backstop's
  candidates. The caller checks liveness cluster-wide before deleting.
  """
  @spec stale_slugs(non_neg_integer()) :: {:ok, [String.t()]} | {:error, :not_configured}
  def stale_slugs(older_than_ms) do
    GenServer.call(__MODULE__, {:stale_slugs, older_than_ms}, :infinity)
  end

  ## Callbacks

  @impl true
  def init(_opts) do
    db = Application.get_env(:blunderfest, __MODULE__)[:db]

    pool =
      if db do
        {:ok, pool} = Postgrex.start_link(Keyword.merge([pool_size: 4, timeout: 30_000], db))
        Store.ensure_schema(pool)
        pool
      else
        nil
      end

    {:ok, %{pool: pool}}
  end

  @impl true
  def handle_call(:configured?, _from, state) do
    {:reply, state.pool != nil, state}
  end

  def handle_call({:load, _slug}, _from, %{pool: nil} = state) do
    {:reply, {:error, :not_configured}, state}
  end

  def handle_call({:load, slug}, _from, state) do
    {:reply, Store.load(state.pool, slug), state}
  end

  def handle_call({:stale_slugs, _older_than_ms}, _from, %{pool: nil} = state) do
    {:reply, {:error, :not_configured}, state}
  end

  def handle_call({:stale_slugs, older_than_ms}, _from, state) do
    {:reply, Store.stale_slugs(state.pool, older_than_ms), state}
  end

  @impl true
  def handle_cast({:append, slug, op, author_name}, %{pool: nil} = state) do
    _ = {slug, op, author_name}
    {:noreply, state}
  end

  def handle_cast({:append, slug, op, author_name}, state) do
    Store.append(state.pool, slug, op, author_name, @max_ops_per_room)
    {:noreply, state}
  end

  def handle_cast({:put_roles, slug, roles}, %{pool: nil} = state) do
    _ = {slug, roles}
    {:noreply, state}
  end

  def handle_cast({:put_roles, slug, roles}, state) do
    Store.put_roles(state.pool, slug, roles)
    {:noreply, state}
  end

  def handle_cast({:delete, slug}, %{pool: nil} = state) do
    _ = slug
    {:noreply, state}
  end

  def handle_cast({:delete, slug}, state) do
    Store.delete(state.pool, slug)
    {:noreply, state}
  end
end
