defmodule BlunderfestWeb.LibraryControllerTest do
  use BlunderfestWeb.ConnCase, async: false

  alias Blunderfest.{Library, Profiles}

  setup do
    Library.reset()
    {:ok, profile, secret} = Profiles.create()
    %{profile: profile, secret: secret}
  end

  defp tree do
    %{
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
  end

  defp authed(conn, secret), do: put_req_header(conn, "authorization", "Bearer " <> secret)

  test "save, list, and delete a game", %{conn: conn, profile: profile, secret: secret} do
    conn =
      conn
      |> authed(secret)
      |> post("/api/profiles/#{profile.id}/library", %{"tree" => tree()})

    assert %{"entry" => %{"id" => entry_id, "title" => "Anna – Boris"}} =
             json_response(conn, 201)

    conn =
      build_conn()
      |> authed(secret)
      |> get("/api/profiles/#{profile.id}/library")

    assert %{"entries" => [%{"id" => ^entry_id, "tree" => %{"result" => "1-0"}}]} =
             json_response(conn, 200)

    conn =
      build_conn()
      |> authed(secret)
      |> delete("/api/profiles/#{profile.id}/library/#{entry_id}")

    assert json_response(conn, 200) == %{}

    conn =
      build_conn()
      |> authed(secret)
      |> get("/api/profiles/#{profile.id}/library")

    assert %{"entries" => []} = json_response(conn, 200)
  end

  test "all routes require the device secret", %{profile: profile} do
    assert json_response(
             post(build_conn(), "/api/profiles/#{profile.id}/library", %{"tree" => tree()}),
             401
           )

    assert json_response(get(build_conn(), "/api/profiles/#{profile.id}/library"), 401)
    assert json_response(delete(build_conn(), "/api/profiles/#{profile.id}/library/x"), 401)
  end

  test "a bad secret is rejected", %{conn: conn, profile: profile} do
    conn =
      conn
      |> put_req_header("authorization", "Bearer wrong")
      |> post("/api/profiles/#{profile.id}/library", %{"tree" => tree()})

    assert json_response(conn, 401)
  end

  test "a missing or invalid tree is rejected", %{conn: conn, profile: profile, secret: secret} do
    conn = conn |> authed(secret) |> post("/api/profiles/#{profile.id}/library", %{})
    assert %{"errors" => %{"code" => "invalid_request"}} = json_response(conn, 400)

    conn =
      build_conn()
      |> authed(secret)
      |> post("/api/profiles/#{profile.id}/library", %{"tree" => %{"no" => "root"}})

    assert %{"errors" => %{"code" => "invalid_tree"}} = json_response(conn, 422)
  end
end
