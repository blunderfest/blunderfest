defmodule BlunderfestWeb.RoomControllerTest do
  use BlunderfestWeb.ConnCase, async: false

  alias Blunderfest.{Profiles, Rooms}

  setup do
    Rooms.reset()
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
  end
end
