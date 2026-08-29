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

  test "accepts a well-formed add_line op" do
    assert :ok =
             Ops.validate(%{
               "type" => "add_line",
               "payload" => %{
                 "game_id" => "game-1",
                 "parent_id" => 0,
                 "moves" => [
                   %{
                     "san" => "e4",
                     "from" => "e2",
                     "to" => "e4",
                     "promotion" => nil,
                     "fen" => "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
                     "status" => "active"
                   }
                 ]
               }
             })
  end

  test "rejects malformed add_line payloads" do
    assert {:error, :invalid_op} =
             Ops.validate(%{
               "type" => "add_line",
               "payload" => %{
                 "game_id" => "game-1",
                 "parent_id" => 0,
                 "moves" => [%{"san" => "e4", "from" => "e9"}]
               }
             })

    assert {:error, :invalid_op} =
             Ops.validate(%{
               "type" => "add_line",
               "payload" => %{"game_id" => "game-1", "parent_id" => 0, "moves" => "e4 e5"}
             })
  end

  test "accepts a well-formed set_nags op" do
    assert :ok =
             Ops.validate(%{
               "type" => "set_nags",
               "payload" => %{"game_id" => "game-1", "node_id" => 3, "nags" => [1, 4]}
             })

    assert :ok =
             Ops.validate(%{
               "type" => "set_nags",
               "payload" => %{"game_id" => "game-1", "node_id" => 3, "nags" => []}
             })
  end

  test "rejects malformed set_nags payloads" do
    assert {:error, :invalid_op} =
             Ops.validate(%{
               "type" => "set_nags",
               "payload" => %{"game_id" => "game-1", "node_id" => 3, "nags" => [999]}
             })

    assert {:error, :invalid_op} =
             Ops.validate(%{
               "type" => "set_nags",
               "payload" => %{"game_id" => "game-1", "node_id" => 3, "nags" => "1"}
             })
  end

  test "accepts a well-formed chat op" do
    assert :ok = Ops.validate(%{"type" => "chat", "payload" => %{"text" => "hello room"}})
  end

  test "rejects malformed chat ops" do
    assert {:error, :invalid_op} = Ops.validate(%{"type" => "chat", "payload" => %{}})
    assert {:error, :invalid_op} = Ops.validate(%{"type" => "chat", "payload" => %{"text" => 42}})

    assert {:error, :invalid_op} =
             Ops.validate(%{
               "type" => "chat",
               "payload" => %{"text" => String.duplicate("x", 501)}
             })
  end

  test "accepts a well-formed delete_chat op" do
    assert :ok = Ops.validate(%{"type" => "delete_chat", "payload" => %{"seq" => 7}})
  end

  test "rejects malformed delete_chat ops" do
    assert {:error, :invalid_op} = Ops.validate(%{"type" => "delete_chat", "payload" => %{}})

    assert {:error, :invalid_op} =
             Ops.validate(%{"type" => "delete_chat", "payload" => %{"seq" => "7"}})

    assert {:error, :invalid_op} =
             Ops.validate(%{"type" => "delete_chat", "payload" => %{"seq" => -1}})
  end

  test "accepts a well-formed remove_game op" do
    assert :ok = Ops.validate(%{"type" => "remove_game", "payload" => %{"game_id" => "game-1"}})
  end

  test "rejects malformed remove_game ops" do
    assert {:error, :invalid_op} = Ops.validate(%{"type" => "remove_game", "payload" => %{}})

    assert {:error, :invalid_op} =
             Ops.validate(%{"type" => "remove_game", "payload" => %{"game_id" => 42}})
  end

  test "edit_op? classifies room edit ops" do
    assert Ops.edit_op?(%{"type" => "move_at_ply"})
    assert Ops.edit_op?(%{"type" => "set_game"})
    assert Ops.edit_op?(%{"type" => "remove_game"})
    assert Ops.edit_op?(%{"type" => "comment_at_ply"})
    assert Ops.edit_op?(%{"type" => "set_annotations"})
    assert Ops.edit_op?(%{"type" => "replace_line"})
    assert Ops.edit_op?(%{"type" => "add_line"})
    assert Ops.edit_op?(%{"type" => "set_nags"})
    refute Ops.edit_op?(%{"type" => "set_cursor"})
    refute Ops.edit_op?(%{"type" => "select_game"})
    refute Ops.edit_op?(%{"type" => "chat"})
    refute Ops.edit_op?(%{"type" => "delete_chat"})
    refute Ops.edit_op?(%{"type" => "unknown"})
    refute Ops.edit_op?(%{})
    refute Ops.edit_op?(nil)
  end

  describe "set_game tree validation" do
    defp tree_node(overrides \\ %{}) do
      Map.merge(
        %{
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
        overrides
      )
    end

    defp set_game_op(root) do
      %{
        "type" => "set_game",
        "payload" => %{
          "game_id" => "game-1",
          "tree" => %{
            "headers" => %{"White" => "Alice"},
            "result" => "*",
            "setup" => nil,
            "root" => root,
            "mainline_ply_count" => 0,
            "node_count" => 1
          }
        }
      }
    end

    test "accepts a well-formed tree, variations included" do
      child = tree_node(%{"id" => 1, "ply" => 1, "san" => "e4"})
      variation = tree_node(%{"id" => 2, "ply" => 1, "san" => "d4"})
      root = tree_node(%{"children" => [child, variation]})

      assert :ok = Ops.validate(set_game_op(root))
    end

    test "accepts the optional evidence_gid marker, rejecting malformed ones" do
      with_gid = Map.update!(set_game_op(tree_node()), "payload", &Map.put(&1, "evidence_gid", 7))
      assert :ok = Ops.validate(with_gid)

      bad =
        Map.update!(set_game_op(tree_node()), "payload", &Map.put(&1, "evidence_gid", "seven"))

      assert {:error, :invalid_op} = Ops.validate(bad)
    end

    test "accepts the optional clock field (integer or fractional seconds)" do
      fractional = tree_node(%{"id" => 2, "ply" => 2, "san" => "e5", "clock" => 7.64})

      child =
        tree_node(%{
          "id" => 1,
          "ply" => 1,
          "san" => "e4",
          "clock" => 296,
          "children" => [fractional]
        })

      root = tree_node(%{"children" => [child]})

      assert :ok = Ops.validate(set_game_op(root))
    end

    test "rejects a clock that isn't a non-negative number" do
      assert {:error, :invalid_op} =
               Ops.validate(set_game_op(tree_node(%{"clock" => "3:00"})))

      assert {:error, :invalid_op} = Ops.validate(set_game_op(tree_node(%{"clock" => -1})))
    end

    test "rejects a root without a children list" do
      assert {:error, :invalid_op} = Ops.validate(set_game_op(%{"id" => 0, "ply" => 0}))
    end

    test "rejects nodes with the wrong field types" do
      assert {:error, :invalid_op} = Ops.validate(set_game_op(tree_node(%{"id" => "root"})))
      assert {:error, :invalid_op} = Ops.validate(set_game_op(tree_node(%{"san" => 42})))

      assert {:error, :invalid_op} =
               Ops.validate(set_game_op(tree_node(%{"children" => "not-a-list"})))
    end

    test "rejects absurdly deep trees that would overflow a client's stack" do
      # Slim nodes, so the depth cap trips before the 256 KB size cap does.
      deep =
        Enum.reduce(1..1_600, %{"id" => 0, "ply" => 0, "children" => []}, fn i, acc ->
          %{"id" => i, "ply" => i, "children" => [acc]}
        end)

      assert {:error, :invalid_op} = Ops.validate(set_game_op(deep))
    end

    test "rejects trees with too many nodes" do
      wide = %{
        "id" => 0,
        "ply" => 0,
        "children" => for(i <- 1..2_001, do: %{"id" => i, "ply" => 1, "children" => []})
      }

      assert {:error, :invalid_op} = Ops.validate(set_game_op(wide))
    end
  end
end
