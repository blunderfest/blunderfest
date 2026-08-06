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

  test "approval_status approves every join while rooms are public", %{store: store} do
    assert Rooms.approval_status("abcde", "profile-1", store) == :approved
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

  test "the first joiner claims the room and becomes owner", %{store: store} do
    assert Rooms.owner("room-a", store) == nil

    Rooms.claim("room-a", "profile-1", store)
    assert Rooms.owner("room-a", store) == "profile-1"
    assert Rooms.role_for("room-a", "profile-1", store) == :owner

    Rooms.claim("room-a", "profile-2", store)
    assert Rooms.owner("room-a", store) == "profile-1"
  end

  test "anonymous members are never recorded and never own the room", %{store: store} do
    Rooms.claim("room-a", "anonymous", store)
    assert Rooms.owner("room-a", store) == nil
    assert Rooms.roles("room-a", store) == %{}

    Rooms.claim("room-a", "profile-1", store)
    assert Rooms.owner("room-a", store) == "profile-1"
  end

  test "unclaimed members are viewers by default", %{store: store} do
    Rooms.claim("room-a", "profile-1", store)
    Rooms.claim("room-a", "profile-2", store)

    assert Rooms.role_for("room-a", "profile-2", store) == :viewer
    assert Rooms.role_for("room-a", "unknown", store) == :viewer
  end

  test "roles survive reconnects", %{store: store} do
    Rooms.claim("room-a", "profile-1", store)
    Rooms.claim("room-a", "profile-2", store)
    Rooms.set_role("room-a", "profile-1", "profile-2", :collaborator, store)

    Rooms.claim("room-a", "profile-2", store)
    assert Rooms.role_for("room-a", "profile-2", store) == :collaborator
  end

  test "the owner can promote and demote other members", %{store: store} do
    Rooms.claim("room-a", "profile-1", store)
    Rooms.claim("room-a", "profile-2", store)

    assert {:ok, :collaborator} =
             Rooms.set_role("room-a", "profile-1", "profile-2", :collaborator, store)

    assert Rooms.role_for("room-a", "profile-2", store) == :collaborator

    assert {:ok, :viewer} = Rooms.set_role("room-a", "profile-1", "profile-2", :viewer, store)
    assert Rooms.role_for("room-a", "profile-2", store) == :viewer
  end

  test "only the owner can change roles", %{store: store} do
    Rooms.claim("room-a", "profile-1", store)
    Rooms.claim("room-a", "profile-2", store)
    Rooms.set_role("room-a", "profile-1", "profile-2", :collaborator, store)

    assert {:error, :forbidden} =
             Rooms.set_role("room-a", "profile-2", "profile-1", :viewer, store)

    assert Rooms.role_for("room-a", "profile-1", store) == :owner
  end

  test "the owner cannot change their own role", %{store: store} do
    Rooms.claim("room-a", "profile-1", store)

    assert {:error, :invalid_member} =
             Rooms.set_role("room-a", "profile-1", "profile-1", :viewer, store)
  end

  test "unknown roles are rejected", %{store: store} do
    Rooms.claim("room-a", "profile-1", store)

    assert {:error, :invalid_role} =
             Rooms.set_role("room-a", "profile-1", "profile-2", :admin, store)
  end

  test "can_edit? is true for owners and collaborators only", %{store: store} do
    Rooms.claim("room-a", "profile-1", store)
    Rooms.claim("room-a", "profile-2", store)
    Rooms.claim("room-a", "profile-3", store)
    Rooms.set_role("room-a", "profile-1", "profile-2", :collaborator, store)

    assert Rooms.can_edit?("room-a", "profile-1", store)
    assert Rooms.can_edit?("room-a", "profile-2", store)
    refute Rooms.can_edit?("room-a", "profile-3", store)
    refute Rooms.can_edit?("room-a", "unknown", store)
  end

  test "edit_op? classifies room edit ops", %{store: _store} do
    assert Rooms.edit_op?(%{"type" => "move_at_ply"})
    assert Rooms.edit_op?(%{"type" => "set_game"})
    assert Rooms.edit_op?(%{"type" => "comment_at_ply"})
    assert Rooms.edit_op?(%{"type" => "add_arrow"})
    assert Rooms.edit_op?(%{"type" => "add_highlight"})
    assert Rooms.edit_op?(%{"type" => "replace_line"})
    refute Rooms.edit_op?(%{"type" => "set_cursor"})
    refute Rooms.edit_op?(%{"type" => "select_game"})
    refute Rooms.edit_op?(%{"type" => "unknown"})
    refute Rooms.edit_op?(%{})
    refute Rooms.edit_op?(nil)
  end

  test "roles returns the full role map", %{store: store} do
    Rooms.claim("room-a", "profile-1", store)
    Rooms.claim("room-a", "profile-2", store)
    Rooms.set_role("room-a", "profile-1", "profile-2", :collaborator, store)

    assert Rooms.roles("room-a", store) == %{"profile-1" => :owner, "profile-2" => :collaborator}
    assert Rooms.roles("room-b", store) == %{}
  end
end
