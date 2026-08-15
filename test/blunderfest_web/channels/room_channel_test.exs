defmodule BlunderfestWeb.RoomChannelTest do
  use BlunderfestWeb.ChannelCase, async: false

  alias Blunderfest.Rooms

  setup do
    Rooms.reset()
    # Joins never create rooms; the tests create theirs up front.
    Rooms.create("abcde", "anonymous")
    Rooms.create("fresh", "anonymous")
    :ok
  end

  defp join_room(topic, params \\ %{}) do
    socket(BlunderfestWeb.UserSocket, "user", %{})
    |> subscribe_and_join(BlunderfestWeb.RoomChannel, topic, params)
  end

  test "join replies with the room's op log", %{} do
    Rooms.append("abcde", %{"type" => "move_at_ply", "payload" => %{"ply" => 1, "san" => "e4"}})
    Rooms.append("abcde", %{"type" => "set_cursor", "payload" => %{"ply" => 2}})

    {:ok, reply, _socket} = join_room("room:abcde")

    assert [%{"seq" => 1}, %{"seq" => 2}] = reply.ops
  end

  test "join replies with an empty log for a fresh room", %{} do
    {:ok, reply, _socket} = join_room("room:fresh")
    assert reply.ops == []
  end

  test "join replies with the node's region", %{} do
    {:ok, reply, _socket} = join_room("room:abcde")
    assert reply.region == "local"
  end

  test "rejects joins with malformed room codes", %{} do
    assert {:error, %{reason: :invalid_code}} = join_room("room:kjhkjhkjhkj")
    assert {:error, %{reason: :invalid_code}} = join_room("room:abc12")
    assert {:error, %{reason: :invalid_code}} = join_room("room:abcd")
    assert {:error, %{reason: :invalid_code}} = join_room("room:abcde!")
    assert Rooms.ops("kjhkjhkjhkj") == []
  end

  test "rejects joins to rooms that were never created", %{} do
    assert {:error, %{reason: :room_not_found}} = join_room("room:zzzqq")
    assert Rooms.ops("zzzqq") == []
  end

  test "pushing an op broadcasts it to all subscribers with seq, ts and author", %{} do
    {:ok, _reply, socket} = join_room("room:abcde", %{"profile_id" => "profile-1"})

    ref =
      push(socket, "op", %{"type" => "move_at_ply", "payload" => %{"ply" => 1, "san" => "e4"}})

    assert_reply ref, :ok

    assert_broadcast "new_op", %{"seq" => 1, "author" => "profile-1", "type" => "move_at_ply"}
  end

  test "a second client sees the op in its join replay", %{} do
    {:ok, _reply, socket1} = join_room("room:abcde", %{"profile_id" => "profile-1"})

    ref =
      push(socket1, "op", %{"type" => "move_at_ply", "payload" => %{"ply" => 1, "san" => "e4"}})

    assert_reply ref, :ok

    {:ok, reply, _socket} =
      socket(BlunderfestWeb.UserSocket, "user2", %{})
      |> subscribe_and_join(BlunderfestWeb.RoomChannel, "room:abcde", %{
        "profile_id" => "profile-2"
      })

    assert length(reply.ops) == 1
    assert %{"seq" => 1, "author" => "profile-1"} = hd(reply.ops)
  end

  test "authors without a profile fall back to anonymous", %{} do
    {:ok, _reply, socket} = join_room("room:abcde")

    ref = push(socket, "op", %{"type" => "set_cursor", "payload" => %{"node_id" => 3}})
    assert_reply ref, :ok

    assert_broadcast "new_op", %{"author" => "anonymous"}
  end

  test "presence tracks joining members", %{} do
    join_room("room:abcde", %{"profile_id" => "profile-1", "name" => "Brave Otter 42"})

    assert_push "presence_diff", %{
      joins: %{"profile-1" => %{metas: [%{name: "Brave Otter 42"}]}}
    }
  end

  test "presence uses the server-side profile name when the client sends no name", %{} do
    {:ok, profile, _secret} = Blunderfest.Profiles.create()
    profile_id = profile.id
    profile_name = profile.name

    join_room("room:abcde", %{"profile_id" => profile_id})

    assert_push "presence_diff", %{
      joins: %{^profile_id => %{metas: [%{name: ^profile_name}]}}
    }
  end

  test "presence reflects members when a new client joins", %{} do
    join_room("room:abcde", %{"profile_id" => "profile-1", "name" => "Brave Otter 42"})

    join_room("room:abcde", %{"profile_id" => "profile-2", "name" => "Swift Falcon 17"})

    assert %{"profile-1" => _, "profile-2" => _} =
             BlunderfestWeb.Presence.list("room:abcde")
  end

  test "a joining client receives the current presence state including themselves", %{} do
    join_room("room:abcde", %{"profile_id" => "profile-1", "name" => "Brave Otter 42"})

    join_room("room:abcde", %{"profile_id" => "profile-2", "name" => "Swift Falcon 17"})

    assert_push "presence_state", %{
      "profile-1" => %{metas: [%{name: "Brave Otter 42"}]},
      "profile-2" => %{metas: [%{name: "Swift Falcon 17"}]}
    }
  end

  test "the first joiner becomes the room owner", %{} do
    {:ok, reply, _socket} = join_room("room:abcde", %{"profile_id" => "profile-1"})
    assert reply.roles == %{"profile-1" => "owner"}
  end

  test "later joiners are viewers and get the full role map", %{} do
    join_room("room:abcde", %{"profile_id" => "profile-1"})

    {:ok, reply, _socket} = join_room("room:abcde", %{"profile_id" => "profile-2"})
    assert reply.roles == %{"profile-1" => "owner", "profile-2" => "viewer"}
  end

  test "anonymous joiners are never recorded and never own the room", %{} do
    {:ok, reply, _socket} = join_room("room:abcde", %{"name" => "No Profile"})
    assert reply.roles == %{}
    assert Rooms.owner("abcde") == nil

    {:ok, reply2, _socket} = join_room("room:abcde", %{"profile_id" => "profile-1"})
    assert reply2.roles == %{"profile-1" => "owner"}
  end

  test "a real profile id is required to claim ownership", %{} do
    {:ok, profile, _secret} = Blunderfest.Profiles.create()

    {:ok, reply, _socket} = join_room("room:abcde", %{"profile_id" => profile.id})
    assert reply.roles == %{profile.id => "owner"}
    assert Rooms.owner("abcde") == profile.id
  end

  test "the owner cannot promote the shared anonymous key", %{} do
    {:ok, _reply, owner} = join_room("room:abcde", %{"profile_id" => "profile-1"})

    ref = push(owner, "set_role", %{"member_id" => "anonymous", "role" => "collaborator"})
    assert_reply ref, :error, %{reason: :invalid_member}
  end

  test "viewers cannot push edit ops", %{} do
    join_room("room:abcde", %{"profile_id" => "profile-1"})
    {:ok, _reply, viewer} = join_room("room:abcde", %{"profile_id" => "profile-2"})

    ref =
      push(viewer, "op", %{"type" => "move_at_ply", "payload" => %{"ply" => 1, "san" => "e4"}})

    assert_reply ref, :error, %{reason: :forbidden}
    refute_receive {:broadcast, _, _, _}
    assert Rooms.ops("room:abcde") == []
  end

  test "viewers cannot push set_position ops", %{} do
    join_room("room:abcde", %{"profile_id" => "profile-1"})
    {:ok, _reply, viewer} = join_room("room:abcde", %{"profile_id" => "profile-2"})

    ref =
      push(viewer, "op", %{
        "type" => "set_position",
        "payload" => %{
          "game_id" => "game-1",
          "parent_id" => 0,
          "fen" => "8/8/8/8/8/8/4K3/4k3 w - - 0 1"
        }
      })

    assert_reply ref, :error, %{reason: :forbidden}
    assert Rooms.ops("room:abcde") == []
  end

  test "viewers can still push cursor and selection ops", %{} do
    join_room("room:abcde", %{"profile_id" => "profile-1"})
    {:ok, _reply, viewer} = join_room("room:abcde", %{"profile_id" => "profile-2"})

    ref = push(viewer, "op", %{"type" => "set_cursor", "payload" => %{"node_id" => 3}})
    assert_reply ref, :ok
    assert_broadcast "new_op", %{"type" => "set_cursor"}
  end

  test "collaborators can push edit ops", %{} do
    {:ok, _reply, owner} = join_room("room:abcde", %{"profile_id" => "profile-1"})
    join_room("room:abcde", %{"profile_id" => "profile-2"})

    ref = push(owner, "set_role", %{"member_id" => "profile-2", "role" => "collaborator"})
    assert_reply ref, :ok

    {:ok, _reply, collaborator} =
      socket(BlunderfestWeb.UserSocket, "user3", %{})
      |> subscribe_and_join(BlunderfestWeb.RoomChannel, "room:abcde", %{
        "profile_id" => "profile-2"
      })

    ref =
      push(collaborator, "op", %{
        "type" => "move_at_ply",
        "payload" => %{"ply" => 1, "san" => "e4"}
      })

    assert_reply ref, :ok
    assert_broadcast "new_op", %{"type" => "move_at_ply"}
  end

  test "the owner can promote a member to collaborator", %{} do
    {:ok, _reply, owner} = join_room("room:abcde", %{"profile_id" => "profile-1"})
    join_room("room:abcde", %{"profile_id" => "profile-2"})

    ref = push(owner, "set_role", %{"member_id" => "profile-2", "role" => "collaborator"})
    assert_reply ref, :ok

    assert_broadcast "role_update", %{"member_id" => "profile-2", "role" => "collaborator"}
  end

  test "the owner can demote a collaborator back to viewer", %{} do
    {:ok, _reply, owner} = join_room("room:abcde", %{"profile_id" => "profile-1"})
    join_room("room:abcde", %{"profile_id" => "profile-2"})
    push(owner, "set_role", %{"member_id" => "profile-2", "role" => "collaborator"})

    ref = push(owner, "set_role", %{"member_id" => "profile-2", "role" => "viewer"})
    assert_reply ref, :ok
    assert_broadcast "role_update", %{"member_id" => "profile-2", "role" => "viewer"}
  end

  test "non-owners cannot change roles", %{} do
    {:ok, _reply, owner} = join_room("room:abcde", %{"profile_id" => "profile-1"})
    join_room("room:abcde", %{"profile_id" => "profile-2"})

    ref = push(owner, "set_role", %{"member_id" => "profile-2", "role" => "collaborator"})
    assert_reply ref, :ok

    {:ok, _reply, collaborator} =
      socket(BlunderfestWeb.UserSocket, "user3", %{})
      |> subscribe_and_join(BlunderfestWeb.RoomChannel, "room:abcde", %{
        "profile_id" => "profile-2"
      })

    ref = push(collaborator, "set_role", %{"member_id" => "profile-1", "role" => "viewer"})
    assert_reply ref, :error, %{reason: :forbidden}
  end

  test "the owner cannot demote themselves", %{} do
    {:ok, _reply, owner} = join_room("room:abcde", %{"profile_id" => "profile-1"})

    ref = push(owner, "set_role", %{"member_id" => "profile-1", "role" => "viewer"})
    assert_reply ref, :error, %{reason: :invalid_member}
  end

  test "invalid roles are rejected", %{} do
    {:ok, _reply, owner} = join_room("room:abcde", %{"profile_id" => "profile-1"})
    join_room("room:abcde", %{"profile_id" => "profile-2"})

    ref = push(owner, "set_role", %{"member_id" => "profile-2", "role" => "admin"})
    assert_reply ref, :error, %{reason: :invalid_role}
  end

  describe "game analysis" do
    test "an editor's analyze_game runs the job and broadcasts the result op", %{} do
      {:ok, _reply, socket} = join_room("room:abcde", %{"profile_id" => "profile-1"})

      ref =
        push(socket, "analyze_game", %{
          "game_id" => "game-1",
          "positions" => [
            %{"ply" => 0, "fen" => "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"},
            %{"ply" => 1, "fen" => "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"}
          ]
        })

      assert_reply ref, :ok

      assert_broadcast "new_op", %{
        "type" => "set_analysis",
        "payload" => %{"game_id" => "game-1", "depth" => 12, "evals" => evals}
      }

      assert [
               %{"ply" => 0, "score" => %{"cp" => 42}, "best_move" => "e2e4"},
               %{"ply" => 1, "score" => %{"cp" => -42}, "best_move" => "e2e4"}
             ] = evals
    end

    test "a checkmate is stored as the result, never as a mate-0 eval", %{} do
      {:ok, _reply, socket} = join_room("room:abcde", %{"profile_id" => "profile-1"})

      ref =
        push(socket, "analyze_game", %{
          "game_id" => "game-1",
          "positions" => [
            %{
              "ply" => 0,
              "fen" => "rnbqkbnr/ppppp2p/5p2/7Q/8/2N5/PPPP1PPP/R1B1KBNR b KQkq - 1 3"
            },
            %{
              "ply" => 1,
              "fen" => "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3"
            }
          ]
        })

      assert_reply ref, :ok

      assert_broadcast "new_op", %{
        "type" => "set_analysis",
        "payload" => %{"evals" => evals}
      }

      # Black mated (Qh5#) is a white win; white mated (Qh4#) is a black win.
      assert [
               %{"ply" => 0, "score" => %{"result" => "1-0"}, "best_move" => nil},
               %{"ply" => 1, "score" => %{"result" => "0-1"}, "best_move" => nil}
             ] = evals
    end

    test "viewers cannot start analysis", %{} do
      join_room("room:abcde", %{"profile_id" => "profile-1"})
      {:ok, _reply, viewer} = join_room("room:abcde", %{"profile_id" => "profile-2"})

      ref =
        push(viewer, "analyze_game", %{
          "game_id" => "game-1",
          "positions" => [
            %{"ply" => 0, "fen" => "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"}
          ]
        })

      assert_reply ref, :error, %{reason: :forbidden}
    end

    test "rejects malformed positions", %{} do
      {:ok, _reply, socket} = join_room("room:abcde", %{"profile_id" => "profile-1"})

      ref =
        push(socket, "analyze_game", %{"game_id" => "game-1", "positions" => [%{"ply" => -1}]})

      assert_reply ref, :error, %{reason: :invalid_request}
    end
  end

  describe "the read-only demo room" do
    test "joining seeds it on demand and replies read-only", %{} do
      refute Rooms.room_exists?("chess")

      {:ok, reply, _socket} = join_room("room:chess", %{"profile_id" => "profile-1"})

      assert reply.read_only == true
      assert [%{"type" => "set_game"}] = reply.ops
      assert reply.roles == %{}
      assert Rooms.owner("chess") == nil
    end

    test "re-seeds after the room process is lost", %{} do
      {:ok, _reply, _socket} = join_room("room:chess")
      Rooms.reset()
      refute Rooms.room_exists?("chess")

      {:ok, reply, _socket} = join_room("room:chess")
      assert [%{"type" => "set_game"}] = reply.ops
    end

    test "rejects every op, including cursor noise", %{} do
      {:ok, _reply, socket} = join_room("room:chess", %{"profile_id" => "profile-1"})

      ref = push(socket, "op", %{"type" => "set_cursor", "payload" => %{"node_id" => 3}})
      assert_reply ref, :error, %{reason: :read_only}

      ref =
        push(socket, "op", %{"type" => "move_at_ply", "payload" => %{"ply" => 1, "san" => "e4"}})

      assert_reply ref, :error, %{reason: :read_only}

      assert [%{"type" => "set_game"}] = Rooms.ops("chess")
    end

    test "tracks no presence", %{} do
      join_room("room:chess", %{"profile_id" => "profile-1", "name" => "Brave Otter 42"})

      assert BlunderfestWeb.Presence.list("room:chess") == %{}
    end
  end
end
