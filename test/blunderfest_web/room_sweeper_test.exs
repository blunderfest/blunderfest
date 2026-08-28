defmodule BlunderfestWeb.RoomSweeperTest do
  # NOT async: the sweeper's backstop reasons about the *global* durable
  # table — `stale_slugs` returns every row, and liveness is checked in the
  # default scope (cluster-wide in production, ADR-0028). Other async tests
  # (RoomsTest's durable-mirror block) park fresh rows in that table from
  # their per-test scopes; a ttl-0 backstop sweep mid-test would see them
  # as orphans and delete them out from under `wait_load`. Serializing this
  # module keeps the global-table reasoning honest.
  use ExUnit.Case, async: false
  alias Blunderfest.Rooms
  alias BlunderfestWeb.Presence

  setup do
    # An isolated registry+supervisor pair per test, like RoomsTest.
    registry = :"room_registry_#{System.unique_integer([:positive])}"
    supervisor = :"room_supervisor_#{System.unique_integer([:positive])}"
    start_supervised!({Horde.Registry, keys: :unique, name: registry, members: :auto})

    start_supervised!(
      {Horde.DynamicSupervisor, name: supervisor, strategy: :one_for_one, members: :auto}
    )

    # Scoped processes share the global durable mirror (ADR-0028): purge
    # this module's fixed slugs so stale rows can't revive into a test.
    for slug <- ["aaaaa", "bbbbb"] do
      Blunderfest.RoomLog.delete(slug)
    end

    _ = :sys.get_state(Blunderfest.RoomLog)
    %{store: {registry, supervisor}, registry: registry}
  end

  test "an idle, empty room is swept", %{store: store, registry: registry} do
    Rooms.create("aaaaa", "anonymous", store)
    [{pid, _}] = Horde.Registry.lookup(registry, "aaaaa")
    ref = Process.monitor(pid)
    start_supervised!({BlunderfestWeb.RoomSweeper, interval_ms: 20, idle_ttl_ms: 0, scope: store})
    assert_receive {:DOWN, ^ref, :process, ^pid, _reason}, 1_000
  end

  test "a room with members present is left alone", %{store: store, registry: registry} do
    Rooms.create("bbbbb", "anonymous", store)
    {:ok, _} = Presence.track(self(), "room:bbbbb", "profile-1", %{name: "Brave Otter 42"})
    [{pid, _}] = Horde.Registry.lookup(registry, "bbbbb")
    ref = Process.monitor(pid)
    start_supervised!({BlunderfestWeb.RoomSweeper, interval_ms: 20, idle_ttl_ms: 0, scope: store})
    # Several sweeps pass; the room survives all of them.
    refute_receive {:DOWN, ^ref, :process, ^pid, _reason}, 150
    assert Rooms.room_exists?("bbbbb", store)
  end

  test "the backstop purges durable rows orphaned by a restart", %{store: store} do
    slug = "orphan#{System.unique_integer([:positive])}"

    # Rows with no live room anywhere (simulating a machine that died and
    # nobody rejoined).
    Blunderfest.RoomLog.append(
      slug,
      %{
        "seq" => 1,
        "type" => "chat",
        "payload" => %{"text" => "x"},
        "author" => "p",
        "ts" => DateTime.utc_now()
      },
      nil
    )

    _ = :sys.get_state(Blunderfest.RoomLog)

    start_supervised!({BlunderfestWeb.RoomSweeper, interval_ms: 20, idle_ttl_ms: 0, scope: store})

    for _ <- 1..200 do
      if Blunderfest.RoomLog.load(slug) == :not_found, do: :ok, else: Process.sleep(10)
    end

    assert :not_found = Blunderfest.RoomLog.load(slug)
  end

  test "the backstop leaves the rows of a live room alone", %{store: store} do
    # A room alive in the default scope: the test-scope sweeper's backstop
    # must not purge it — room_exists? is cluster-wide, so liveness on any
    # node protects the rows.
    slug = "live#{System.unique_integer([:positive])}"
    Rooms.create(slug, "anonymous")
    Rooms.append(slug, %{"type" => "chat", "payload" => %{"text" => "hi"}})
    _ = :sys.get_state(Blunderfest.RoomLog)
    on_exit(fn -> Rooms.reset() end)

    start_supervised!({BlunderfestWeb.RoomSweeper, interval_ms: 20, idle_ttl_ms: 0, scope: store})
    Process.sleep(120)

    assert Rooms.room_exists?(slug)
    assert match?({:ok, %{ops: [%{"type" => "chat"}]}}, Blunderfest.RoomLog.load(slug))
  end
end
