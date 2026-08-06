defmodule BlunderfestWeb.RoomChannelTest do
  use BlunderfestWeb.ChannelCase, async: false

  alias Blunderfest.Rooms

  setup do
    Rooms.reset()
    :ok
  end

  defp join_room(topic, params \\ %{}) do
    socket(BlunderfestWeb.UserSocket, "user", %{})
    |> subscribe_and_join(BlunderfestWeb.RoomChannel, topic, params)
  end

  test "join replies with the room's op log", %{} do
    Rooms.append("a", %{"type" => "move_at_ply", "payload" => %{"ply" => 1, "san" => "e4"}})
    Rooms.append("a", %{"type" => "set_cursor", "payload" => %{"ply" => 2}})

    {:ok, reply, _socket} = join_room("room:a")

    assert [%{"seq" => 1}, %{"seq" => 2}] = reply.ops
  end

  test "join replies with an empty log for a fresh room", %{} do
    {:ok, reply, _socket} = join_room("room:fresh")
    assert reply.ops == []
  end

  test "pushing an op broadcasts it to all subscribers with seq, ts and author", %{} do
    {:ok, _reply, socket} = join_room("room:a", %{"profile_id" => "profile-1"})

    ref =
      push(socket, "op", %{"type" => "move_at_ply", "payload" => %{"ply" => 1, "san" => "e4"}})

    assert_reply ref, :ok

    assert_broadcast "new_op", %{"seq" => 1, "author" => "profile-1", "type" => "move_at_ply"}
  end

  test "a second client sees the op in its join replay", %{} do
    {:ok, _reply, socket1} = join_room("room:a", %{"profile_id" => "profile-1"})

    ref =
      push(socket1, "op", %{"type" => "move_at_ply", "payload" => %{"ply" => 1, "san" => "e4"}})

    assert_reply ref, :ok

    {:ok, reply, _socket} =
      socket(BlunderfestWeb.UserSocket, "user2", %{})
      |> subscribe_and_join(BlunderfestWeb.RoomChannel, "room:a", %{"profile_id" => "profile-2"})

    assert length(reply.ops) == 1
    assert %{"seq" => 1, "author" => "profile-1"} = hd(reply.ops)
  end

  test "authors without a profile fall back to anonymous", %{} do
    {:ok, _reply, socket} = join_room("room:a")

    ref = push(socket, "op", %{"type" => "set_cursor", "payload" => %{"ply" => 3}})
    assert_reply ref, :ok

    assert_broadcast "new_op", %{"author" => "anonymous"}
  end

  test "presence tracks joining members", %{} do
    join_room("room:a", %{"profile_id" => "profile-1", "name" => "Brave Otter 42"})

    assert_push "presence_diff", %{
      joins: %{"profile-1" => %{metas: [%{name: "Brave Otter 42"}]}}
    }
  end

  test "presence uses the server-side profile name when the client sends no name", %{} do
    {:ok, profile, _secret} = Blunderfest.Profiles.create()
    profile_id = profile.id
    profile_name = profile.name

    join_room("room:a", %{"profile_id" => profile_id})

    assert_push "presence_diff", %{
      joins: %{^profile_id => %{metas: [%{name: ^profile_name}]}}
    }
  end

  test "presence reflects members when a new client joins", %{} do
    join_room("room:a", %{"profile_id" => "profile-1", "name" => "Brave Otter 42"})

    join_room("room:a", %{"profile_id" => "profile-2", "name" => "Swift Falcon 17"})

    assert %{"profile-1" => _, "profile-2" => _} =
             BlunderfestWeb.Presence.list("room:a")
  end

  test "a joining client receives the current presence state including themselves", %{} do
    join_room("room:a", %{"profile_id" => "profile-1", "name" => "Brave Otter 42"})

    join_room("room:a", %{"profile_id" => "profile-2", "name" => "Swift Falcon 17"})

    assert_push "presence_state", %{
      "profile-1" => %{metas: [%{name: "Brave Otter 42"}]},
      "profile-2" => %{metas: [%{name: "Swift Falcon 17"}]}
    }
  end

  test "the first joiner becomes the room owner", %{} do
    {:ok, reply, _socket} = join_room("room:a", %{"profile_id" => "profile-1"})
    assert reply.roles == %{"profile-1" => "owner"}
  end

  test "later joiners are viewers and get the full role map", %{} do
    join_room("room:a", %{"profile_id" => "profile-1"})

    {:ok, reply, _socket} = join_room("room:a", %{"profile_id" => "profile-2"})
    assert reply.roles == %{"profile-1" => "owner", "profile-2" => "viewer"}
  end

  test "anonymous joiners are never recorded and never own the room", %{} do
    {:ok, reply, _socket} = join_room("room:a", %{"name" => "No Profile"})
    assert reply.roles == %{}
    assert Rooms.owner("a") == nil

    {:ok, reply2, _socket} = join_room("room:a", %{"profile_id" => "profile-1"})
    assert reply2.roles == %{"profile-1" => "owner"}
  end

  test "a real profile id is required to claim ownership", %{} do
    {:ok, profile, _secret} = Blunderfest.Profiles.create()

    {:ok, reply, _socket} = join_room("room:a", %{"profile_id" => profile.id})
    assert reply.roles == %{profile.id => "owner"}
    assert Rooms.owner("a") == profile.id
  end

  test "the owner cannot promote the shared anonymous key", %{} do
    {:ok, _reply, owner} = join_room("room:a", %{"profile_id" => "profile-1"})

    ref = push(owner, "set_role", %{"member_id" => "anonymous", "role" => "collaborator"})
    assert_reply ref, :error, %{reason: :invalid_member}
  end

  test "viewers cannot push edit ops", %{} do
    join_room("room:a", %{"profile_id" => "profile-1"})
    {:ok, _reply, viewer} = join_room("room:a", %{"profile_id" => "profile-2"})

    ref =
      push(viewer, "op", %{"type" => "move_at_ply", "payload" => %{"ply" => 1, "san" => "e4"}})

    assert_reply ref, :error, %{reason: :forbidden}
    refute_receive {:broadcast, _, _, _}
    assert Rooms.ops("room:a") == []
  end

  test "viewers can still push cursor and selection ops", %{} do
    join_room("room:a", %{"profile_id" => "profile-1"})
    {:ok, _reply, viewer} = join_room("room:a", %{"profile_id" => "profile-2"})

    ref = push(viewer, "op", %{"type" => "set_cursor", "payload" => %{"ply" => 3}})
    assert_reply ref, :ok
    assert_broadcast "new_op", %{"type" => "set_cursor"}
  end

  test "collaborators can push edit ops", %{} do
    {:ok, _reply, owner} = join_room("room:a", %{"profile_id" => "profile-1"})
    join_room("room:a", %{"profile_id" => "profile-2"})

    ref = push(owner, "set_role", %{"member_id" => "profile-2", "role" => "collaborator"})
    assert_reply ref, :ok

    {:ok, _reply, collaborator} =
      socket(BlunderfestWeb.UserSocket, "user3", %{})
      |> subscribe_and_join(BlunderfestWeb.RoomChannel, "room:a", %{"profile_id" => "profile-2"})

    ref =
      push(collaborator, "op", %{
        "type" => "move_at_ply",
        "payload" => %{"ply" => 1, "san" => "e4"}
      })

    assert_reply ref, :ok
    assert_broadcast "new_op", %{"type" => "move_at_ply"}
  end

  test "the owner can promote a member to collaborator", %{} do
    {:ok, _reply, owner} = join_room("room:a", %{"profile_id" => "profile-1"})
    join_room("room:a", %{"profile_id" => "profile-2"})

    ref = push(owner, "set_role", %{"member_id" => "profile-2", "role" => "collaborator"})
    assert_reply ref, :ok

    assert_broadcast "role_update", %{"member_id" => "profile-2", "role" => "collaborator"}
  end

  test "the owner can demote a collaborator back to viewer", %{} do
    {:ok, _reply, owner} = join_room("room:a", %{"profile_id" => "profile-1"})
    join_room("room:a", %{"profile_id" => "profile-2"})
    push(owner, "set_role", %{"member_id" => "profile-2", "role" => "collaborator"})

    ref = push(owner, "set_role", %{"member_id" => "profile-2", "role" => "viewer"})
    assert_reply ref, :ok
    assert_broadcast "role_update", %{"member_id" => "profile-2", "role" => "viewer"}
  end

  test "non-owners cannot change roles", %{} do
    {:ok, _reply, owner} = join_room("room:a", %{"profile_id" => "profile-1"})
    join_room("room:a", %{"profile_id" => "profile-2"})

    ref = push(owner, "set_role", %{"member_id" => "profile-2", "role" => "collaborator"})
    assert_reply ref, :ok

    {:ok, _reply, collaborator} =
      socket(BlunderfestWeb.UserSocket, "user3", %{})
      |> subscribe_and_join(BlunderfestWeb.RoomChannel, "room:a", %{"profile_id" => "profile-2"})

    ref = push(collaborator, "set_role", %{"member_id" => "profile-1", "role" => "viewer"})
    assert_reply ref, :error, %{reason: :forbidden}
  end

  test "the owner cannot demote themselves", %{} do
    {:ok, _reply, owner} = join_room("room:a", %{"profile_id" => "profile-1"})

    ref = push(owner, "set_role", %{"member_id" => "profile-1", "role" => "viewer"})
    assert_reply ref, :error, %{reason: :invalid_member}
  end

  test "invalid roles are rejected", %{} do
    {:ok, _reply, owner} = join_room("room:a", %{"profile_id" => "profile-1"})
    join_room("room:a", %{"profile_id" => "profile-2"})

    ref = push(owner, "set_role", %{"member_id" => "profile-2", "role" => "admin"})
    assert_reply ref, :error, %{reason: :invalid_role}
  end
end
