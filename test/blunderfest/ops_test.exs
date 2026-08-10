defmodule Blunderfest.OpsTest do
  use ExUnit.Case, async: true

  alias Blunderfest.Ops

  test "accepts a well-formed move op" do
    assert :ok =
             Ops.validate(%{
               "type" => "move_at_ply",
               "payload" => %{
                 "game_id" => "game-1",
                 "ply" => 1,
                 "san" => "e4",
                 "from" => "e2",
                 "to" => "e4",
                 "fen" => "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
                 "status" => "active",
                 "parent_id" => 0
               }
             })
  end

  test "rejects unknown types and non-map payloads" do
    assert {:error, :invalid_op} = Ops.validate(%{"type" => "drop_table", "payload" => %{}})
    assert {:error, :invalid_op} = Ops.validate("not a map")
    assert {:error, :invalid_op} = Ops.validate(%{"type" => "move_at_ply"})
  end

  test "rejects moves with malformed squares" do
    assert {:error, :invalid_op} =
             Ops.validate(%{
               "type" => "move_at_ply",
               "payload" => %{"ply" => 1, "san" => "e4", "from" => "e9"}
             })
  end

  test "rejects oversized payloads" do
    assert {:error, :op_too_large} =
             Ops.validate(%{
               "type" => "comment_at_ply",
               "payload" => %{"ply" => 1, "text" => String.duplicate("x", 300_000)}
             })
  end

  test "validates annotation shapes" do
    assert :ok =
             Ops.validate(%{
               "type" => "set_annotations",
               "payload" => %{
                 "game_id" => "g",
                 "node_id" => 1,
                 "arrows" => [%{"from" => "e2", "to" => "e4", "color" => "#3b82f6"}],
                 "highlights" => [%{"square" => "e4", "color" => "#e05a4e"}]
               }
             })

    assert {:error, :invalid_op} =
             Ops.validate(%{
               "type" => "set_annotations",
               "payload" => %{
                 "node_id" => 1,
                 "arrows" => [%{"from" => "e2", "to" => "e4", "color" => "blue"}],
                 "highlights" => []
               }
             })
  end
end
