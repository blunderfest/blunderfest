defmodule Blunderfest.RoomsTest do
  use ExUnit.Case, async: true

  alias Blunderfest.Rooms

  setup do
    # Each test gets an isolated registry+supervisor pair (a "scope") so
    # room processes never leak between async tests.
    registry = :"room_registry_#{System.unique_integer([:positive])}"
    supervisor = :"room_supervisor_#{System.unique_integer([:positive])}"
    start_supervised!({Horde.Registry, keys: :unique, name: registry, members: :auto})

    start_supervised!(
      {Horde.DynamicSupervisor, name: supervisor, strategy: :one_for_one, members: :auto}
    )

    %{store: {registry, supervisor}}
  end

  test "ops returns an empty list for an unknown room", %{store: store} do
    assert Rooms.ops("fresh-room", store) == []
  end

  test "approval_status approves every join while rooms are public", %{store: store} do
    assert Rooms.approval_status("abcde", "profile-1", store) == :approved
  end

  test "room_exists? is false until the room is created", %{store: store} do
    refute Rooms.room_exists?("abcde", store)
    Rooms.create("abcde", "anonymous", store)
    assert Rooms.room_exists?("abcde", store)
  end

  test "create records the first profiled creator as owner", %{store: store} do
    Rooms.create("abcde", "profile-1", store)
    assert Rooms.owner("abcde", store) == "profile-1"
  end

  test "create with an anonymous creator leaves the room ownerless", %{store: store} do
    Rooms.create("abcde", "anonymous", store)
    assert Rooms.owner("abcde", store) == nil
  end

  test "re-creating an existing room keeps its ops", %{store: store} do
    Rooms.create("abcde", "anonymous", store)
    Rooms.append("abcde", %{"type" => "set_cursor", "payload" => %{"ply" => 1}}, store)
    Rooms.create("abcde", "anonymous", store)
    assert length(Rooms.ops("abcde", store)) == 1
  end

  test "append stamps seq starting at 1 and ts", %{store: store} do
    {:ok, op} =
      Rooms.append(
        "room-a",
        %{"type" => "move_at_ply", "payload" => %{"ply" => 1, "san" => "e4"}},
        store
      )

    assert op["seq"] == 1
    assert is_struct(op["ts"], DateTime)

    {:ok, op2} =
      Rooms.append("room-a", %{"type" => "set_cursor", "payload" => %{"ply" => 2}}, store)

    assert op2["seq"] == 2
  end

  test "ops returns ops in append order", %{store: store} do
    Rooms.append("room-a", %{"type" => "move_at_ply"}, store)
    Rooms.append("room-a", %{"type" => "set_cursor"}, store)

    assert Enum.map(Rooms.ops("room-a", store), & &1["seq"]) == [1, 2]
  end

  test "seq counters are per-room", %{store: store} do
    Rooms.append("room-a", %{"type" => "move_at_ply"}, store)
    {:ok, op} = Rooms.append("room-b", %{"type" => "move_at_ply"}, store)
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

  test "read-only rooms record no members and allow no edits", %{store: store} do
    Rooms.create("abcde", "profile-1", store, read_only: true)

    assert Rooms.read_only?("abcde", store)
    assert Rooms.owner("abcde", store) == nil

    Rooms.claim("abcde", "profile-2", store)
    assert Rooms.owner("abcde", store) == nil
    assert Rooms.roles("abcde", store) == %{}
    refute Rooms.can_edit?("abcde", "profile-1", store)
    refute Rooms.can_edit?("abcde", "profile-2", store)

    assert {:error, :forbidden} =
             Rooms.set_role("abcde", "profile-1", "profile-2", :collaborator, store)
  end

  test "rooms are writable by default", %{store: store} do
    Rooms.create("abcde", "anonymous", store)
    refute Rooms.read_only?("abcde", store)
    refute Rooms.read_only?("unknown", store)
  end

  test "submit_op appends owner ops and rejects viewer edits atomically", %{store: store} do
    Rooms.create("room-a", "profile-1", store)
    Rooms.claim("room-a", "profile-2", store)

    assert {:ok, op} =
             Rooms.submit_op(
               "room-a",
               "profile-1",
               %{"type" => "move_at_ply", "payload" => %{"ply" => 1, "san" => "e4"}},
               store
             )

    assert op["seq"] == 1

    assert {:error, :forbidden} =
             Rooms.submit_op(
               "room-a",
               "profile-2",
               %{"type" => "move_at_ply", "payload" => %{"ply" => 1, "san" => "e5"}},
               store
             )

    # Non-edit ops (cursor noise) are still allowed for viewers.
    assert {:ok, _} =
             Rooms.submit_op(
               "room-a",
               "profile-2",
               %{"type" => "set_cursor", "payload" => %{"node_id" => 3}},
               store
             )

    assert Enum.map(Rooms.ops("room-a", store), & &1["seq"]) == [1, 2]
  end

  test "submit_op rejects everything for read-only rooms", %{store: store} do
    Rooms.create("room-a", "anonymous", store, read_only: true)

    assert {:error, :read_only} =
             Rooms.submit_op(
               "room-a",
               "profile-1",
               %{"type" => "set_cursor", "payload" => %{"node_id" => 3}},
               store
             )
  end

  test "chat needs edit rights; delete_chat is owner-only and must name a chat op", %{
    store: store
  } do
    Rooms.create("room-a", "profile-1", store)
    Rooms.claim("room-a", "profile-2", store)
    Rooms.claim("room-a", "profile-3", store)
    {:ok, _} = Rooms.set_role("room-a", "profile-1", "profile-2", :collaborator, store)

    # Owner and collaborator chat; the viewer doesn't.
    assert {:ok, _} =
             Rooms.submit_op(
               "room-a",
               "profile-1",
               %{"type" => "chat", "payload" => %{"text" => "hi"}},
               store
             )

    assert {:ok, _} =
             Rooms.submit_op(
               "room-a",
               "profile-2",
               %{"type" => "chat", "payload" => %{"text" => "yo"}},
               store
             )

    assert {:error, :forbidden} =
             Rooms.submit_op(
               "room-a",
               "profile-3",
               %{"type" => "chat", "payload" => %{"text" => "me too"}},
               store
             )

    # The owner deletes message 1; a collaborator can't, and the seq must be
    # an actual chat op (2 is, 99 doesn't exist).
    assert {:error, :forbidden} =
             Rooms.submit_op(
               "room-a",
               "profile-2",
               %{"type" => "delete_chat", "payload" => %{"seq" => 1}},
               store
             )

    assert {:error, :invalid_op} =
             Rooms.submit_op(
               "room-a",
               "profile-1",
               %{"type" => "delete_chat", "payload" => %{"seq" => 99}},
               store
             )

    assert {:ok, _} =
             Rooms.submit_op(
               "room-a",
               "profile-1",
               %{"type" => "delete_chat", "payload" => %{"seq" => 1}},
               store
             )

    assert Enum.map(Rooms.ops("room-a", store), & &1["type"]) == ["chat", "chat", "delete_chat"]
  end

  test "join_snapshot claims membership and returns the room state in one call", %{store: store} do
    Rooms.create("room-a", "anonymous", store)
    Rooms.append("room-a", %{"type" => "set_cursor", "payload" => %{"node_id" => 1}}, store)

    snapshot = Rooms.join_snapshot("room-a", "profile-1", store)

    assert [%{"seq" => 1}] = snapshot.ops
    assert snapshot.roles == %{"profile-1" => :owner}
    assert snapshot.read_only == false
    assert Rooms.owner("room-a", store) == "profile-1"
  end

  test "roles returns the full role map", %{store: store} do
    Rooms.claim("room-a", "profile-1", store)
    Rooms.claim("room-a", "profile-2", store)
    Rooms.set_role("room-a", "profile-1", "profile-2", :collaborator, store)

    assert Rooms.roles("room-a", store) == %{"profile-1" => :owner, "profile-2" => :collaborator}
    assert Rooms.roles("room-b", store) == %{}
  end

  test "rooms are capped", %{store: store} do
    for i <- 1..1000 do
      Rooms.create("room#{i}", "anonymous", store)
    end

    assert {:error, :room_limit} = Rooms.create("onemore", "anonymous", store)
  end

  test "ops per room are capped", %{store: store} do
    for _ <- 1..5_000 do
      Rooms.append("full", %{"type" => "set_cursor", "payload" => %{"node_id" => 1}}, store)
    end

    assert {:error, :op_limit} =
             Rooms.append(
               "full",
               %{"type" => "set_cursor", "payload" => %{"node_id" => 2}},
               store
             )
  end

  test "evict_idle stops rooms idle past the ttl when nobody is present", %{
    store: {registry, _sup} = store
  } do
    Rooms.create("aaaaa", "anonymous", store)
    [{pid, _}] = Horde.Registry.lookup(registry, "aaaaa")
    ref = Process.monitor(pid)

    Rooms.evict_idle(store, 0, fn _slug -> false end)

    assert_receive {:DOWN, ^ref, :process, ^pid, _reason}
    assert_unregistered(registry, "aaaaa")
  end

  test "evict_idle keeps rooms within the ttl and rooms with members", %{
    store: {registry, _sup} = store
  } do
    Rooms.create("aaaaa", "anonymous", store)
    Rooms.create("bbbbb", "anonymous", store)

    # Nothing is idle past an hour.
    Rooms.evict_idle(store, :timer.hours(1), fn _slug -> false end)
    assert Rooms.room_exists?("aaaaa", store)
    assert Rooms.room_exists?("bbbbb", store)

    # With a zero ttl, only the room with members survives.
    Rooms.evict_idle(store, 0, fn slug -> slug == "bbbbb" end)
    assert_unregistered(registry, "aaaaa")
    assert Rooms.room_exists?("bbbbb", store)
  end

  test "each room runs as its own registered process", %{store: {registry, _sup} = store} do
    Rooms.create("aaaaa", "anonymous", store)
    Rooms.create("bbbbb", "anonymous", store)

    [{pid_a, _}] = Horde.Registry.lookup(registry, "aaaaa")
    [{pid_b, _}] = Horde.Registry.lookup(registry, "bbbbb")
    assert pid_a != pid_b
  end

  test "appends to different rooms proceed independently", %{store: store} do
    Rooms.create("aaaaa", "anonymous", store)
    Rooms.create("bbbbb", "anonymous", store)

    tasks =
      for slug <- ["aaaaa", "bbbbb"], _ <- 1..50 do
        Task.async(fn -> Rooms.append(slug, %{"type" => "set_cursor"}, store) end)
      end

    assert tasks |> Task.await_many() |> Enum.all?(&match?({:ok, _}, &1))
    assert Enum.map(Rooms.ops("aaaaa", store), & &1["seq"]) == Enum.to_list(1..50)
    assert Enum.map(Rooms.ops("bbbbb", store), & &1["seq"]) == Enum.to_list(1..50)
  end

  test "a stopped room is gone (temporary) and leaves other rooms alone", %{
    store: {registry, _sup} = store
  } do
    Rooms.create("aaaaa", "anonymous", store)
    Rooms.append("aaaaa", %{"type" => "set_cursor"}, store)
    Rooms.create("bbbbb", "anonymous", store)

    [{pid, _}] = Horde.Registry.lookup(registry, "aaaaa")
    ref = Process.monitor(pid)
    GenServer.stop(pid)
    assert_receive {:DOWN, ^ref, :process, ^pid, :normal}
    assert_unregistered(registry, "aaaaa")

    refute Rooms.room_exists?("aaaaa", store)
    assert Rooms.ops("aaaaa", store) == []
    assert Rooms.room_exists?("bbbbb", store)
  end

  # Registry unregisters a dead process asynchronously; poll briefly so the
  # assertions above can't race the cleanup.
  defp assert_unregistered(registry, slug, attempts \\ 50)

  defp assert_unregistered(registry, slug, 0) do
    flunk(
      "expected #{slug} to be unregistered, got #{inspect(Horde.Registry.lookup(registry, slug))}"
    )
  end

  defp assert_unregistered(registry, slug, attempts) do
    case Horde.Registry.lookup(registry, slug) do
      [] ->
        :ok

      _ ->
        Process.sleep(10)
        assert_unregistered(registry, slug, attempts - 1)
    end
  end
end
