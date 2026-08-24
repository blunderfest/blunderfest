defmodule Blunderfest.Game.Node do
  @moduledoc """
  A move node in the game tree.

  `children` holds every move playable from this node's position: the first
  child is the mainline, further children are variations. `from`/`to` are
  algebraic squares (e.g. "e2", "g8"); `promotion` is a piece letter
  ("Q"/"R"/"B"/"N") or `nil`. `fen` is the position after the move.

  `clock` is the mover's remaining clock after the move, in seconds
  (extracted at parse time from `[%clk …]` comments — Lichess/Chess.com
  exports carry them; the move-time timeline is built from it client-side).
  """

  defstruct [
    :id,
    :ply,
    :san,
    :from,
    :to,
    :promotion,
    :comment,
    :clock,
    :nags,
    :status,
    :fen,
    children: []
  ]

  @type t :: %__MODULE__{
          id: non_neg_integer(),
          ply: non_neg_integer(),
          san: String.t(),
          from: String.t() | nil,
          to: String.t() | nil,
          promotion: String.t() | nil,
          comment: String.t() | nil,
          clock: number() | nil,
          nags: [non_neg_integer()],
          status: atom(),
          fen: String.t() | nil,
          children: [t()]
        }
end

defmodule Blunderfest.Game.Tree do
  @moduledoc """
  A parsed game: headers, result, optional setup FEN, and the move tree.

  The root node represents the starting position (ply 0, no SAN).
  """

  defstruct [:headers, :result, :setup, :root]

  @type t :: %__MODULE__{
          headers: %{optional(String.t()) => String.t()},
          result: String.t(),
          setup: %{fen: String.t()} | nil,
          root: Blunderfest.Game.Node.t() | nil
        }

  @doc "The number of plies on the mainline (first-child chain)."
  @spec mainline_ply_count(t()) :: non_neg_integer()
  def mainline_ply_count(%__MODULE__{root: nil}), do: 0
  def mainline_ply_count(%__MODULE__{root: root}), do: node_depth(root) - 1

  defp node_depth(%{children: [mainline | _]}), do: 1 + node_depth(mainline)
  defp node_depth(%{children: []}), do: 1

  @doc "The total number of nodes across all variations."
  @spec node_count(t()) :: non_neg_integer()
  def node_count(%__MODULE__{root: root}), do: count(root)

  defp count(nil), do: 0
  defp count(%{children: children}), do: 1 + Enum.sum(Enum.map(children, &count/1))

  @doc """
  The plain-map (JSON-ready) shape of the tree — what the API and the demo
  room seeder send to clients.
  """
  def to_map(%__MODULE__{} = tree) do
    %{
      headers: tree.headers,
      result: tree.result,
      setup: tree.setup,
      root: node_to_map(tree.root),
      mainline_ply_count: mainline_ply_count(tree),
      node_count: node_count(tree)
    }
  end

  defp node_to_map(%Blunderfest.Game.Node{} = node) do
    %{
      id: node.id,
      ply: node.ply,
      san: node.san,
      from: node.from,
      to: node.to,
      promotion: node.promotion,
      comment: node.comment,
      clock: node.clock,
      nags: node.nags,
      status: node.status,
      fen: node.fen,
      children: Enum.map(node.children, &node_to_map/1)
    }
  end
end
