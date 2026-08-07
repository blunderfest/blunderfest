defmodule Blunderfest.DemoRoom do
  @moduledoc """
  Seeds a public demo room at a well-known code on boot: a short annotated
  game with a variation, so first-time visitors (and our own testing) always
  have a live room to look at.

  The room is ownerless — the first profiled joiner becomes its owner, like
  any room. State is in-memory, so every boot re-seeds it fresh.
  """

  alias Blunderfest.Game.Tree
  alias Blunderfest.{PGN, Rooms}

  @code "chess"

  @pgn """
  [Event "Demo: The Opera Game"]
  [White "Paul Morphy"]
  [Black "Duke Karl & Count Isouard"]
  [Date "1858.11.02"]
  [Result "1-0"]

  1. e4 e5 2. Nf3 d6 3. d4 Bg4 {The pin looks annoying, but it doesn't hold up.} 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 (8. Qxb7 Qb4+ 9. Qxb4 Bxb4+ {and Black wins the queen back with interest}) 8... c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0
  """

  @doc "The demo room's code."
  def code, do: @code

  @doc "Creates and populates the demo room unless it already exists. Never fails boot."
  def seed do
    if not Rooms.room_exists?(@code) do
      Rooms.create(@code, "anonymous")

      case PGN.parse(@pgn) do
        {:ok, tree} ->
          Rooms.append(@code, %{
            "type" => "set_game",
            "author" => "Blunderfest",
            "payload" => %{"game_id" => "demo-opera", "tree" => Tree.to_map(tree)}
          })

        {:error, _} ->
          # An unparseable demo PGN leaves an empty demo room, never a crash.
          :ok
      end
    end

    :ok
  end
end
