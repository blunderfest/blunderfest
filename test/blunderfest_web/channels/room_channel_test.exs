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

  test "presence reflects members when a new client joins", %{} do
    join_room("room:a", %{"profile_id" => "profile-1", "name" => "Brave Otter 42"})

    join_room("room:a", %{"profile_id" => "profile-2", "name" => "Swift Falcon 17"})

    assert %{"profile-1" => _, "profile-2" => _} =
             BlunderfestWeb.Presence.list("room:a")
  end
end
