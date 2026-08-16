defmodule BlunderfestWeb.LichessControllerTest do
  use BlunderfestWeb.ConnCase

  alias Blunderfest.Profiles

  setup do
    Profiles.reset()
    :ok
  end

  defp linked_profile do
    {:ok, profile, secret} = Profiles.create()

    {:ok, _} =
      Profiles.link_account(profile.id, %{
        type: "lichess",
        username: "dr_ny",
        token: "tok-123",
        scopes: ["study:read"],
        linked_at: DateTime.utc_now()
      })

    {profile, secret}
  end

  defp authed(conn, secret, profile) do
    put_req_header(conn, "authorization", "Bearer #{secret}")
    |> Map.put(:params, Map.merge(conn.params, %{"profile_id" => profile.id}))
  end

  describe "GET /api/lichess/studies" do
    test "lists the linked account's studies", %{conn: conn} do
      {profile, secret} = linked_profile()

      Req.Test.stub(Blunderfest.Lichess, fn conn ->
        assert conn.request_path == "/api/study/by/dr_ny"

        Req.Test.text(
          conn,
          ~s({"id":"WTvnkWAL","name":"Guess the move","createdAt":1463756350225,"updatedAt":1469965025205}
{"id":"abcdefgh","name":"Endgames","createdAt":1463756350225,"updatedAt":1469965025206})
        )
      end)

      conn =
        conn
        |> authed(secret, profile)
        |> get("/api/lichess/studies", %{"profile_id" => profile.id})

      assert %{"studies" => [first, second]} = json_response(conn, 200)
      assert first["id"] == "WTvnkWAL"
      assert first["name"] == "Guess the move"
      assert second["name"] == "Endgames"
    end

    test "requires a linked lichess account", %{conn: conn} do
      {:ok, profile, secret} = Profiles.create()

      conn =
        conn
        |> authed(secret, profile)
        |> get("/api/lichess/studies", %{"profile_id" => profile.id})

      assert %{"errors" => %{"code" => "lichess_not_linked"}} = json_response(conn, 403)
    end

    test "requires device credentials", %{conn: conn} do
      conn = get(conn, "/api/lichess/studies", %{"profile_id" => "nope"})

      assert %{"errors" => %{"code" => "unauthorized"}} = json_response(conn, 401)
    end

    test "returns 502 when the fetch fails", %{conn: conn} do
      {profile, secret} = linked_profile()
      Req.Test.stub(Blunderfest.Lichess, &Req.Test.transport_error(&1, :econnrefused))

      conn =
        conn
        |> authed(secret, profile)
        |> get("/api/lichess/studies", %{"profile_id" => profile.id})

      assert %{"errors" => %{"code" => "lichess_fetch_failed"}} = json_response(conn, 502)
    end
  end

  describe "POST /api/import/lichess-study" do
    test "imports every chapter with per-game failure reporting", %{conn: conn} do
      {profile, secret} = linked_profile()

      study_pgn = """
      [Event "Study: Chapter 1"]
      [White "Alice"]
      [Black "Bob"]

      1. e4 e5 2. Nf3 Nc6 1-0

      [Event "Study: Chapter 2"]
      [White "Carol"]
      [Black "Dan"]

      1. d4 garbage *
      """

      Req.Test.stub(Blunderfest.Lichess, fn conn ->
        assert conn.request_path == "/api/study/WTvnkWAL.pgn"
        Req.Test.text(conn, study_pgn)
      end)

      conn =
        conn
        |> authed(secret, profile)
        |> post("/api/import/lichess-study", %{
          "profile_id" => profile.id,
          "study_id" => "WTvnkWAL"
        })

      assert %{"trees" => [tree], "failures" => [failure]} = json_response(conn, 200)
      assert tree["headers"]["Event"] == "Study: Chapter 1"
      assert failure["index"] == 2
    end

    test "returns 404 when the study does not exist", %{conn: conn} do
      {profile, secret} = linked_profile()

      Req.Test.stub(Blunderfest.Lichess, fn conn ->
        conn |> Plug.Conn.put_status(404) |> Req.Test.text("not found")
      end)

      conn =
        conn
        |> authed(secret, profile)
        |> post("/api/import/lichess-study", %{
          "profile_id" => profile.id,
          "study_id" => "nope"
        })

      assert %{"errors" => %{"code" => "lichess_study_not_found"}} = json_response(conn, 404)
    end

    test "requires study_id", %{conn: conn} do
      {profile, secret} = linked_profile()

      conn =
        conn
        |> authed(secret, profile)
        |> post("/api/import/lichess-study", %{"profile_id" => profile.id})

      assert %{"errors" => %{"code" => "invalid_request"}} = json_response(conn, 400)
    end

    test "requires a linked lichess account", %{conn: conn} do
      {:ok, profile, secret} = Profiles.create()

      conn =
        conn
        |> authed(secret, profile)
        |> post("/api/import/lichess-study", %{
          "profile_id" => profile.id,
          "study_id" => "WTvnkWAL"
        })

      assert %{"errors" => %{"code" => "lichess_not_linked"}} = json_response(conn, 403)
    end
  end
end
