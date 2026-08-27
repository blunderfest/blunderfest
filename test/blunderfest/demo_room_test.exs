defmodule Blunderfest.DemoRoomTest do
  use ExUnit.Case, async: false

  alias Blunderfest.{DemoRoom, Rooms}

  setup do
    Rooms.reset()
    :ok
  end

  test "seeds a room with an annotated game" do
    DemoRoom.seed()

    assert Rooms.room_exists?(DemoRoom.code())

    [op] = Rooms.ops(DemoRoom.code())
    assert op["type"] == "set_game"
    assert op["payload"]["tree"][:headers]["White"] == "Paul Morphy"
    assert op["payload"]["tree"][:node_count] > 30
  end

  test "seeding is idempotent", %{} do
    DemoRoom.seed()
    DemoRoom.seed()

    assert length(Rooms.ops(DemoRoom.code())) == 1
  end

  test "an existing but empty demo room gets its game back" do
    # A zombie registration or a raced eviction can leave the room alive
    # with no ops; the seed must repopulate it, not just check existence.
    Rooms.create(DemoRoom.code(), "anonymous", Rooms.default_scope(), read_only: true)
    assert Rooms.ops(DemoRoom.code()) == []

    DemoRoom.seed()

    assert [%{"type" => "set_game"}] = Rooms.ops(DemoRoom.code())
    assert Rooms.read_only?(DemoRoom.code())
  end

  test "the demo game keeps its comments and variation", %{} do
    DemoRoom.seed()

    [op] = Rooms.ops(DemoRoom.code())
    json = Jason.encode!(op["payload"]["tree"])
    assert json =~ "doesn't hold up"
    assert json =~ "wins the queen back"
  end

  test "the demo room is read-only: joiners gain no owner, roles, or edit rights" do
    DemoRoom.seed()

    assert Rooms.read_only?(DemoRoom.code())

    Rooms.claim(DemoRoom.code(), "profile-1")
    assert Rooms.owner(DemoRoom.code()) == nil
    assert Rooms.roles(DemoRoom.code()) == %{}
    refute Rooms.can_edit?(DemoRoom.code(), "profile-1")
  end

  test "the demo code is reserved" do
    assert DemoRoom.reserved?("chess")
    refute DemoRoom.reserved?("abcde")
  end

  test "a demo room started off the seed path is still read-only" do
    # Regression (observed live): during deploy churn the seed's existence
    # check can observe a zombie registry entry and skip creation; the
    # join's ensure_room then restarts the process with default opts —
    # writable, first joiner becomes owner, and the ops persist from then
    # on. The reserved slug alone must force read-only at init, and the
    # durable log must never revive it.
    Rooms.join_snapshot(DemoRoom.code(), "profile-1")

    assert Rooms.read_only?(DemoRoom.code())
    assert Rooms.owner(DemoRoom.code()) == nil
    assert Rooms.roles(DemoRoom.code()) == %{}
    refute Rooms.can_edit?(DemoRoom.code(), "profile-1")

    # And the next seed still repopulates it with the demo game.
    DemoRoom.seed()
    assert [%{"type" => "set_game"}] = Rooms.ops(DemoRoom.code())
  end
end
