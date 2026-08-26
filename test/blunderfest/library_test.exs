defmodule Blunderfest.LibraryTest do
  use ExUnit.Case, async: false

  alias Blunderfest.Library
  alias Blunderfest.Profiles

  setup do
    Library.reset()
    Profiles.reset()

    {:ok, profile, _secret} = Profiles.create()
    {:ok, other, _secret} = Profiles.create()

    %{profile_id: profile.id, other_id: other.id}
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

  test "save and list entries, newest first, titled from the players", %{profile_id: profile_id} do
    assert {:ok, first} = Library.save(profile_id, tree("Anna"))
    assert {:ok, second} = Library.save(profile_id, tree("Carol"))

    assert [^second, ^first] = Library.list(profile_id)
    assert first.title == "Anna – Boris"
    assert first.tree["headers"]["White"] == "Anna"
  end

  test "libraries are per-profile", %{profile_id: profile_id, other_id: other_id} do
    Library.save(profile_id, tree())

    assert Library.list(other_id) == []
  end

  test "delete removes an entry", %{profile_id: profile_id} do
    {:ok, entry} = Library.save(profile_id, tree())
    {:ok, other} = Library.save(profile_id, tree("Carol"))

    assert :ok = Library.delete(profile_id, entry.id)
    assert [^other] = Library.list(profile_id)
  end

  test "rejects structurally invalid trees", %{profile_id: profile_id} do
    assert {:error, :invalid_tree} = Library.save(profile_id, %{"headers" => %{}})
  end

  test "the library is capped per profile", %{profile_id: profile_id} do
    for _ <- 1..50, do: Library.save(profile_id, tree())

    assert {:error, :library_full} = Library.save(profile_id, tree())
  end
end
