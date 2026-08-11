defmodule Blunderfest.LibraryTest do
  use ExUnit.Case, async: false

  alias Blunderfest.Library

  setup do
    Library.reset()
    :ok
  end

  defp tree(white \\ "Anna") do
    %{
      "headers" => %{"White" => white, "Black" => "Boris"},
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

  test "save and list entries, newest first, titled from the players" do
    assert {:ok, first} = Library.save("profile-1", tree("Anna"))
    assert {:ok, second} = Library.save("profile-1", tree("Carol"))

    assert [^second, ^first] = Library.list("profile-1")
    assert first.title == "Anna – Boris"
    assert first.tree["headers"]["White"] == "Anna"
  end

  test "libraries are per-profile" do
    Library.save("profile-1", tree())

    assert Library.list("profile-2") == []
  end

  test "delete removes an entry" do
    {:ok, entry} = Library.save("profile-1", tree())
    {:ok, other} = Library.save("profile-1", tree("Carol"))

    assert :ok = Library.delete("profile-1", entry.id)
    assert [^other] = Library.list("profile-1")
  end

  test "rejects structurally invalid trees" do
    assert {:error, :invalid_tree} = Library.save("profile-1", %{"headers" => %{}})
  end

  test "the library is capped per profile" do
    for _ <- 1..50, do: Library.save("profile-1", tree())

    assert {:error, :library_full} = Library.save("profile-1", tree())
  end
end
