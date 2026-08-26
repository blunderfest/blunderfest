defmodule BlunderfestWeb.RoomSweeper do
  @moduledoc """
  Evicts rooms that have been idle and empty for a while, so the room cap
  can't be exhausted by abandoned rooms.

  A room is evicted when both hold: nobody is present in its channel topic
  (no open tabs), and it has seen no activity (no joins, ops, or role
  changes) for `idle_ttl_ms`. Either alone is enough to keep it: a room
  with members present is alive even when quiet, and a room with recent
  activity keeps its state for members coming back. Losing one means the
  room expires — the same semantics as a crash or a scale-to-zero reboot
  (ADR-0001), and the not-found page already says a room may have expired.

  The demo room sweeps like any other — with nobody watching it's idle by
  definition (read-only rooms track no presence), and the next visit
  re-seeds it on demand (ADR-0014), invisibly.

  The sweeper lives in the web layer (not with the domain): membership is
  read from Phoenix Presence, which the domain must not depend on. Each
  cluster node sweeps only the rooms hosted on it.
  """

  use GenServer

  alias Blunderfest.RoomLog
  alias Blunderfest.Rooms
  alias BlunderfestWeb.Presence

  @default_interval_ms :timer.minutes(1)
  @default_idle_ttl_ms :timer.hours(1)

  # Unnamed: sweeping is self-driven, nothing calls it, and tests start
  # their own scoped instances.
  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts)
  end

  @impl true
  def init(opts) do
    state = %{
      interval_ms: Keyword.get(opts, :interval_ms, @default_interval_ms),
      idle_ttl_ms: Keyword.get(opts, :idle_ttl_ms, @default_idle_ttl_ms),
      scope: Keyword.get(opts, :scope, Rooms.default_scope())
    }

    Process.send_after(self(), :sweep, state.interval_ms)
    {:ok, state}
  end

  @impl true
  def handle_info(:sweep, state) do
    Rooms.evict_idle(state.scope, state.idle_ttl_ms, &room_has_members?/1)
    purge_orphaned_rows(state.idle_ttl_ms)
    Process.send_after(self(), :sweep, state.interval_ms)
    {:noreply, state}
  end

  defp room_has_members?(slug) do
    Presence.list("room:" <> slug) != %{}
  end

  # ADR-0028's backstop: durable rows whose room never came back after a
  # machine restart. "Idle and no live process anywhere in the cluster" —
  # the registry lookup is cluster-wide, so a room hosted on the other
  # node is never purged.
  defp purge_orphaned_rows(idle_ttl_ms) do
    with {:ok, slugs} <- RoomLog.stale_slugs(idle_ttl_ms) do
      for slug <- slugs, not Rooms.room_exists?(slug) do
        RoomLog.delete(slug)
      end
    end

    :ok
  catch
    :exit, _ -> :ok
  end
end
