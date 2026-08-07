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

  test "the demo game keeps its comments and variation", %{} do
    DemoRoom.seed()

    [op] = Rooms.ops(DemoRoom.code())
    json = Jason.encode!(op["payload"]["tree"])
    assert json =~ "doesn't hold up"
    assert json =~ "wins the queen back"
  end
end
