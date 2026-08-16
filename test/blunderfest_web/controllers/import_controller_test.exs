defmodule BlunderfestWeb.ImportControllerTest do
  use BlunderfestWeb.ConnCase

  @valid_pgn """
  [Event "Test Game"]
  [White "Alice"]
  [Black "Bob"]

  1. e4 e5 2. Nf3 (2. f4 exf4) Nc6 *
  """

  describe "POST /api/import/pgn" do
    test "returns the parsed game tree", %{conn: conn} do
      conn = post(conn, "/api/import/pgn", %{"pgn" => @valid_pgn})

      assert %{"tree" => tree} = json_response(conn, 200)
      assert tree["headers"]["White"] == "Alice"
      assert tree["result"] == "*"
      assert tree["mainline_ply_count"] == 4
      assert tree["node_count"] == 7
      assert tree["root"]["fen"] =~ "rnbqkbnr/pppppppp"
      assert tree["root"]["children"] |> hd() |> Map.get("fen") =~ "4P3"

      [e4] = tree["root"]["children"]
      [e5] = e4["children"]
      [nf3, f4] = e5["children"]
      assert e4["san"] == "e4"
      assert e4["from"] == "e2" and e4["to"] == "e4"
      assert e5["ply"] == 2
      assert nf3["san"] == "Nf3" and nf3["ply"] == 3
      assert Enum.map(nf3["children"], & &1["san"]) == ["Nc6"]
      assert f4["san"] == "f4" and f4["ply"] == 3
      assert Enum.map(f4["children"], & &1["san"]) == ["exf4"]
    end

    test "serializes a setup FEN", %{conn: conn} do
      pgn = """
      [Setup "1"]
      [FEN "6k1/5ppp/8/8/8/8/8/R6K w - - 0 1"]

      1. Ra8# 1-0
      """

      conn = post(conn, "/api/import/pgn", %{"pgn" => pgn})

      assert %{"tree" => tree} = json_response(conn, 200)
      assert tree["setup"]["fen"] =~ "6k1"
      assert hd(tree["root"]["children"])["status"] == "checkmate"
    end

    test "returns 422 with a structured detail for an unparseable game", %{conn: conn} do
      conn = post(conn, "/api/import/pgn", %{"pgn" => "1. Qh4 e5 *"})

      assert %{
               "errors" => %{"code" => "invalid_pgn", "detail" => %{"reason" => "no_move_found"}}
             } = json_response(conn, 422)
    end

    test "returns 413 when the PGN exceeds the size limit", %{conn: conn} do
      huge = String.duplicate("1. e4 ", 50_000)

      conn = post(conn, "/api/import/pgn", %{"pgn" => huge})

      assert %{"errors" => %{"code" => "pgn_too_large"}} = json_response(conn, 413)
    end

    test "imports the good games of a mixed multi-game PGN and reports the failures", %{
      conn: conn
    } do
      pgn = """
      [Event "Good 1"]
      [White "Alice"]
      [Black "Bob"]

      1. e4 e5 2. Nf3 Nc6 1-0

      [Event "Bad"]
      [White "Carol"]
      [Black "Dan"]

      1. d4 garbage *

      [Event "Good 2"]
      [White "Eve"]
      [Black "Frank"]

      1. c4 e5 0-1
      """

      conn = post(conn, "/api/import/pgn", %{"pgn" => pgn})

      assert %{"trees" => trees, "failures" => [failure]} = json_response(conn, 200)
      assert Enum.map(trees, & &1["headers"]["Event"]) == ["Good 1", "Good 2"]
      assert failure["index"] == 2
      assert failure["detail"]["reason"] == "invalid_san_format"
    end

    test "returns 422 when no game in a multi-game PGN parses", %{conn: conn} do
      pgn = "1. e4 garbage *\n\n[Event \"G2\"]\n\n1. d4 nonsense *\n"

      conn = post(conn, "/api/import/pgn", %{"pgn" => pgn})

      assert %{"errors" => %{"code" => "invalid_pgn", "detail" => %{"reason" => _}}} =
               json_response(conn, 422)
    end

    test "returns 400 when pgn is missing", %{conn: conn} do
      conn = post(conn, "/api/import/pgn", %{})

      assert %{"errors" => %{"code" => "invalid_request"}} = json_response(conn, 400)
    end

    test "returns 400 when pgn is not a string", %{conn: conn} do
      conn = post(conn, "/api/import/pgn", %{"pgn" => 42})

      assert %{"errors" => %{"code" => "invalid_request"}} = json_response(conn, 400)
    end
  end

  describe "POST /api/import/lichess" do
    test "fetches the game and returns the parsed tree", %{conn: conn} do
      Req.Test.stub(Blunderfest.Lichess, fn conn ->
        assert conn.request_path == "/game/export/abc123"
        Req.Test.text(conn, @valid_pgn)
      end)

      conn = post(conn, "/api/import/lichess", %{"url" => "https://lichess.org/abc123"})

      assert %{"tree" => tree} = json_response(conn, 200)
      assert tree["headers"]["White"] == "Alice"
      assert tree["mainline_ply_count"] == 4
      assert tree["node_count"] == 7
    end

    test "accepts bare game ids", %{conn: conn} do
      Req.Test.stub(Blunderfest.Lichess, fn conn ->
        assert conn.request_path == "/game/export/abc123"
        Req.Test.text(conn, @valid_pgn)
      end)

      conn = post(conn, "/api/import/lichess", %{"url" => "abc123"})

      assert json_response(conn, 200)
    end

    test "returns 422 for a non-lichess url", %{conn: conn} do
      conn = post(conn, "/api/import/lichess", %{"url" => "https://chessgames.com/x"})

      assert %{"errors" => %{"code" => "invalid_lichess_url"}} = json_response(conn, 422)
    end

    test "returns 404 when the game does not exist", %{conn: conn} do
      Req.Test.stub(Blunderfest.Lichess, fn conn ->
        conn |> Plug.Conn.put_status(404) |> Req.Test.text("Game not found")
      end)

      conn = post(conn, "/api/import/lichess", %{"url" => "https://lichess.org/abc123"})

      assert %{"errors" => %{"code" => "lichess_game_not_found"}} = json_response(conn, 404)
    end

    test "returns 502 when the fetch fails", %{conn: conn} do
      Req.Test.stub(Blunderfest.Lichess, &Req.Test.transport_error(&1, :econnrefused))

      conn = post(conn, "/api/import/lichess", %{"url" => "https://lichess.org/abc123"})

      assert %{"errors" => %{"code" => "lichess_fetch_failed"}} = json_response(conn, 502)
    end

    test "returns 400 when url is missing", %{conn: conn} do
      conn = post(conn, "/api/import/lichess", %{})

      assert %{"errors" => %{"code" => "invalid_request"}} = json_response(conn, 400)
    end
  end
end
