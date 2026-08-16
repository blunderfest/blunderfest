defmodule BlunderfestWeb.ChesscomControllerTest do
  use BlunderfestWeb.ConnCase

  alias Blunderfest.Profiles

  setup do
    Profiles.reset()
    :ok
  end

  defp profile_with_secret do
    {:ok, profile, secret} = Profiles.create()
    {profile, secret}
  end

  defp authed(conn, secret, profile) do
    put_req_header(conn, "authorization", "Bearer #{secret}")
    |> Map.put(:params, Map.merge(conn.params, %{"profile_id" => profile.id}))
  end

  defp stub_archive(games) do
    Req.Test.stub(Blunderfest.Chesscom, fn conn ->
      assert conn.request_path =~ ~r|^/pub/player/[^/]+/games/\d{4}/\d{2}$|
      Req.Test.json(conn, %{"games" => games})
    end)
  end

  defp game(overrides \\ %{}) do
    Map.merge(
      %{
        "url" => "https://www.chess.com/game/live/172353500956",
        "pgn" => "1. e4 e5 *",
        "time_class" => "blitz",
        "end_time" => 1_785_530_931,
        "white" => %{"username" => "Alice", "result" => "resigned"},
        "black" => %{"username" => "Hikaru", "result" => "win"}
      },
      overrides
    )
  end

  describe "GET /api/chesscom/games" do
    test "lists a player's month with compact summaries", %{conn: conn} do
      {profile, secret} = profile_with_secret()
      stub_archive([game()])

      conn =
        conn
        |> authed(secret, profile)
        |> get("/api/chesscom/games", %{
          "profile_id" => profile.id,
          "username" => "hikaru",
          "year" => "2026",
          "month" => "7"
        })

      assert %{"games" => [entry]} = json_response(conn, 200)
      assert entry["id"] == "172353500956"
      assert entry["white"] == "Alice"
      assert entry["black"] == "Hikaru"
      assert entry["result"] == "0-1"
      assert entry["speed"] == "blitz"
      assert entry["pgn"] =~ "1. e4 e5"
    end

    test "computes white wins and draws", %{conn: conn} do
      {profile, secret} = profile_with_secret()

      stub_archive([
        game(%{
          "white" => %{"username" => "A", "result" => "win"},
          "black" => %{"username" => "B", "result" => "resigned"}
        }),
        game(%{
          "url" => "https://www.chess.com/game/live/2",
          "white" => %{"username" => "A", "result" => "agreed"},
          "black" => %{"username" => "B", "result" => "agreed"}
        })
      ])

      conn =
        conn
        |> authed(secret, profile)
        |> get("/api/chesscom/games", %{
          "profile_id" => profile.id,
          "username" => "hikaru",
          "year" => "2026",
          "month" => "7"
        })

      assert %{"games" => games} = json_response(conn, 200)
      assert Enum.map(games, & &1["result"]) == ["1-0", "1/2-1/2"]
    end

    test "returns 404 for an unknown player", %{conn: conn} do
      {profile, secret} = profile_with_secret()

      Req.Test.stub(Blunderfest.Chesscom, fn conn ->
        conn |> Plug.Conn.put_status(404) |> Req.Test.text("not found")
      end)

      conn =
        conn
        |> authed(secret, profile)
        |> get("/api/chesscom/games", %{
          "profile_id" => profile.id,
          "username" => "nope",
          "year" => "2026",
          "month" => "7"
        })

      assert %{"errors" => %{"code" => "chesscom_player_not_found"}} = json_response(conn, 404)
    end

    test "requires a username and a sane month", %{conn: conn} do
      {profile, secret} = profile_with_secret()

      conn =
        conn
        |> authed(secret, profile)
        |> get("/api/chesscom/games", %{"profile_id" => profile.id, "year" => "2026"})

      assert %{"errors" => %{"code" => "invalid_request"}} = json_response(conn, 400)

      conn =
        build_conn()
        |> authed(secret, profile)
        |> get("/api/chesscom/games", %{
          "profile_id" => profile.id,
          "username" => "hikaru",
          "year" => "2026",
          "month" => "13"
        })

      assert %{"errors" => %{"code" => "invalid_request"}} = json_response(conn, 400)
    end

    test "requires device credentials", %{conn: conn} do
      conn =
        get(conn, "/api/chesscom/games", %{
          "profile_id" => "nope",
          "username" => "hikaru",
          "year" => "2026",
          "month" => "7"
        })

      assert %{"errors" => %{"code" => "unauthorized"}} = json_response(conn, 401)
    end

    test "returns 502 when the fetch fails", %{conn: conn} do
      {profile, secret} = profile_with_secret()
      Req.Test.stub(Blunderfest.Chesscom, &Req.Test.transport_error(&1, :econnrefused))

      conn =
        conn
        |> authed(secret, profile)
        |> get("/api/chesscom/games", %{
          "profile_id" => profile.id,
          "username" => "hikaru",
          "year" => "2026",
          "month" => "7"
        })

      assert %{"errors" => %{"code" => "chesscom_fetch_failed"}} = json_response(conn, 502)
    end
  end
end
