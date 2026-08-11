defmodule BlunderfestWeb.RoomControllerTest do
  use BlunderfestWeb.ConnCase, async: false

  alias Blunderfest.{Profiles, RateLimit, Rooms}

  setup do
    Rooms.reset()
    RateLimit.reset()
    :ok
  end

  describe "POST /api/rooms" do
    test "creates a room and returns its code", %{conn: conn} do
      conn = post(conn, "/api/rooms", %{"code" => "abcde"})

      assert %{"code" => "abcde"} = json_response(conn, 201)
      assert Rooms.room_exists?("abcde")
    end

    test "the authenticated creator becomes the room owner", %{conn: conn} do
      {:ok, profile, secret} = Profiles.create()

      conn =
        conn
        |> put_req_header("authorization", "Bearer " <> secret)
        |> post("/api/rooms", %{"code" => "abcde", "profile_id" => profile.id})

      assert json_response(conn, 201)["code"] == "abcde"
      assert Rooms.owner("abcde") == profile.id
    end

    test "a mismatched profile is ignored and the room is created anonymously", %{conn: conn} do
      {:ok, _profile, secret} = Profiles.create()
      {:ok, other, _other_secret} = Profiles.create()

      conn =
        conn
        |> put_req_header("authorization", "Bearer " <> secret)
        |> post("/api/rooms", %{"code" => "abcde", "profile_id" => other.id})

      assert json_response(conn, 201)["code"] == "abcde"
      assert Rooms.owner("abcde") == nil
    end

    test "rejects codes outside the canonical format", %{conn: conn} do
      conn = post(conn, "/api/rooms", %{"code" => "kjhkjhkjhkj"})

      assert %{"errors" => %{"code" => "invalid_code"}} = json_response(conn, 422)
      refute Rooms.room_exists?("kjhkjhkjhkj")
    end

    test "rejects a missing code", %{conn: conn} do
      conn = post(conn, "/api/rooms", %{})

      assert %{"errors" => %{"code" => "invalid_code"}} = json_response(conn, 422)
    end

    test "the demo code is reserved", %{conn: conn} do
      conn = post(conn, "/api/rooms", %{"code" => "chess"})

      assert %{"errors" => %{"code" => "code_reserved"}} = json_response(conn, 422)
      refute Rooms.room_exists?("chess")
    end

    test "a tree seeds the room with the game on creation", %{conn: conn} do
      tree = %{
        "headers" => %{"White" => "Anna", "Black" => "Boris"},
        "result" => "1-0",
        "root" => %{
          "id" => 0,
          "ply" => 0,
          "san" => nil,
          "from" => nil,
          "to" => nil,
          "promotion" => nil,
          "comment" => nil,
          "nags" => [],
          "status" => "active",
          "fen" => "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          "children" => []
        },
        "mainline_ply_count" => 0,
        "node_count" => 1
      }

      conn = post(conn, "/api/rooms", %{"code" => "abcde", "tree" => tree})

      assert json_response(conn, 201)
      assert [%{"type" => "set_game", "payload" => %{"tree" => ^tree}}] = Rooms.ops("abcde")
    end

    test "an invalid tree is rejected without creating the room", %{conn: conn} do
      conn = post(conn, "/api/rooms", %{"code" => "abcde", "tree" => %{"no" => "root"}})

      assert %{"errors" => %{"code" => "invalid_tree"}} = json_response(conn, 422)
      refute Rooms.room_exists?("abcde")
    end

    test "re-seeding an existing room keeps its state", %{conn: conn} do
      post(conn, "/api/rooms", %{"code" => "abcde"})
      Rooms.append("abcde", %{"type" => "set_cursor", "payload" => %{"node_id" => 1}})

      conn =
        build_conn()
        |> post("/api/rooms", %{
          "code" => "abcde",
          "tree" => %{
            "root" => %{"id" => 0, "ply" => 0, "children" => []}
          }
        })

      assert json_response(conn, 201)
      assert [%{"type" => "set_cursor"}] = Rooms.ops("abcde")
    end

    test "creation is rate limited per client", %{conn: conn} do
      # The default limit is 10/min per IP; all test conns share 127.0.0.1.
      for code <- valid_codes(10) do
        assert %{status: 201} = post(conn, "/api/rooms", %{"code" => code})
      end

      conn = post(conn, "/api/rooms", %{"code" => "ttttt"})

      assert %{"errors" => %{"code" => "rate_limited"}} = json_response(conn, 429)
      refute Rooms.room_exists?("ttttt")
    end
  end

  # `count` distinct codes from the room alphabet (i/l/o/0/1 are excluded).
  defp valid_codes(count) do
    alphabet = String.graphemes("abcdefghjkmnpqrstuvwxyz23456789")
    size = length(alphabet)

    for i <- 0..(count - 1) do
      Enum.map_join(0..4, fn j -> Enum.at(alphabet, rem(i * 5 + j, size)) end)
    end
  end
end
