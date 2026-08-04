defmodule Blunderfest.RoomsTest do
  use ExUnit.Case, async: true

  alias Blunderfest.Rooms

  setup do
    store = :"rooms_#{System.unique_integer([:positive])}"
    start_supervised!({Blunderfest.Rooms, name: store})
    %{store: store}
  end

  test "ops returns an empty list for an unknown room", %{store: store} do
    assert Rooms.ops("fresh-room", store) == []
  end

  test "append stamps seq starting at 1 and ts", %{store: store} do
    op =
      Rooms.append(
        "room-a",
        %{"type" => "move_at_ply", "payload" => %{"ply" => 1, "san" => "e4"}},
        store
      )

    assert op["seq"] == 1
    assert is_struct(op["ts"], DateTime)

    op2 = Rooms.append("room-a", %{"type" => "set_cursor", "payload" => %{"ply" => 2}}, store)
    assert op2["seq"] == 2
  end

  test "ops returns ops in append order", %{store: store} do
    Rooms.append("room-a", %{"type" => "move_at_ply"}, store)
    Rooms.append("room-a", %{"type" => "set_cursor"}, store)

    assert Enum.map(Rooms.ops("room-a", store), & &1["seq"]) == [1, 2]
  end

  test "seq counters are per-room", %{store: store} do
    Rooms.append("room-a", %{"type" => "move_at_ply"}, store)
    op = Rooms.append("room-b", %{"type" => "move_at_ply"}, store)
    assert op["seq"] == 1
  end

  test "reset empties all rooms", %{store: store} do
    Rooms.append("room-a", %{"type" => "move_at_ply"}, store)
    Rooms.reset(store)
    assert Rooms.ops("room-a", store) == []
  end
end
