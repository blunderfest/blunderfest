defmodule BlunderfestWeb.MovesControllerTest do
  use BlunderfestWeb.ConnCase

  @start_fen "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

  describe "POST /api/games/moves" do
    test "returns legal moves with derived node data", %{conn: conn} do
      conn = post(conn, "/api/games/moves", %{"fen" => @start_fen})

      assert %{"moves" => moves} = json_response(conn, 200)
      assert length(moves) == 20

      e4 = Enum.find(moves, &(&1["san"] == "e4"))
      assert e4["from"] == "e2"
      assert e4["to"] == "e4"
      assert e4["promotion"] == nil
      assert e4["status"] == "active"
      assert e4["fen"] =~ "4P3"

      assert Enum.any?(moves, &(&1["san"] == "e4"))
    end

    test "includes castling when legal", %{conn: conn} do
      fen = "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/R3K2R w KQkq - 4 4"
      conn = post(conn, "/api/games/moves", %{"fen" => fen})

      assert %{"moves" => moves} = json_response(conn, 200)
      assert Enum.find(moves, &(&1["san"] == "O-O"))["to"] == "g1"
      assert Enum.find(moves, &(&1["san"] == "O-O-O"))["to"] == "c1"
    end

    test "returns 422 for an invalid fen", %{conn: conn} do
      conn = post(conn, "/api/games/moves", %{"fen" => "garbage"})

      assert json_response(conn, 422) == %{"errors" => %{"code" => "invalid_fen"}}
    end

    test "returns 400 when fen is missing", %{conn: conn} do
      conn = post(conn, "/api/games/moves", %{})

      assert json_response(conn, 400) == %{"errors" => %{"code" => "invalid_request"}}
    end
  end
end
