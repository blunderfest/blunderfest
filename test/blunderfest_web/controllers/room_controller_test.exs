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
