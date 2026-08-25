defmodule BlunderfestWeb.HistoricalEvidenceControllerTest do
  # async: false — the corpus tables are rebuilt from the research fixture.
  use BlunderfestWeb.ConnCase, async: false

  @moduletag :tmp_dir

  alias Blunderfest.Corpus.{Extraction, TestFixtures}

  setup context do
    dir = Path.join(context.tmp_dir, "data")
    File.mkdir_p!(dir)
    corpus = Path.join(dir, "fixture.pgn")
    File.write!(corpus, TestFixtures.pgn())

    out = Path.join(dir, "extracted")
    Extraction.run(corpus, games: 13, out_dir: out)
    Blunderfest.Corpus.rebuild(out, 13)

    :ok
  end

  test "POST /api/historical-evidence returns the evidence DTO" do
    conn =
      post(build_conn(), "/api/historical-evidence", %{fen: TestFixtures.tabiya_key() <> " 0 1"})

    assert conn.status == 200
    result = json_response(conn, 200)

    assert result["reference"]["occurrences"] == 11
    assert result["reference"]["games"] == 8
    assert is_list(result["candidates"])
    assert is_map(result["timings"])
  end

  test "the B1 tempo twin rides through the HTTP layer" do
    ref =
      ~w(d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7 Ne1 Ne8 Nd3 f5 Bd2 Kh8 Rc1 a5)

    conn =
      post(build_conn(), "/api/historical-evidence", %{
        fen: TestFixtures.tabiya_key() <> " 0 1",
        route: ref,
        ref_ply: 16
      })

    result = json_response(conn, 200)
    b1 = Enum.find(result["candidates"], &(&1["gid"] == 5))

    assert "tempo_twin" in b1["flags"]
    assert b1["route"]["shared_plies"] == 6
    assert b1["route"]["ref_move"] == "e4"
    assert b1["route"]["cand_move"] == "e3"
    assert b1["families"]["skeleton"]["black"]["status"] == "member"
    assert b1["families"]["skeleton"]["white"]["status"] == "none"
  end

  test "a missing or invalid fen is a structured 422" do
    conn = post(build_conn(), "/api/historical-evidence", %{})
    assert conn.status == 422
    assert json_response(conn, 422)["errors"]["code"] == "invalid_fen"

    conn = post(build_conn(), "/api/historical-evidence", %{fen: "garbage"})
    assert conn.status == 422
    assert json_response(conn, 422)["errors"]["code"] == "invalid_fen"
  end

  test "GET /api/historical-evidence/games/:gid returns the playable tree" do
    conn = get(build_conn(), "/api/historical-evidence/games/1")

    assert conn.status == 200
    result = json_response(conn, 200)

    assert result["tree"]["headers"]["White"] == "A"
    [first | _] = result["tree"]["root"]["children"]
    assert first["san"] == "d4"
  end

  test "an unknown gid is a structured 404" do
    conn = get(build_conn(), "/api/historical-evidence/games/999999")
    assert conn.status == 404
    assert json_response(conn, 404)["errors"]["code"] == "game_not_found"
  end
end
