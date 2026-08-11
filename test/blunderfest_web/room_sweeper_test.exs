defmodule BlunderfestWeb.RoomSweeperTest do
  use ExUnit.Case, async: true

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
end
