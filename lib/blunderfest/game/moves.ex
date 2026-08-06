defmodule Blunderfest.Game.Moves do
  @moduledoc """
  Legal moves and SAN generation for a FEN position.

  `Echecs` resolves SAN to a move but cannot produce SAN for a move, so this
  module implements the reverse direction — disambiguation, en passant,
  promotions, check/checkmate suffixes — on top of `Echecs.legal_moves/1`.

  Every returned move carries everything a client needs to append a node to a
  game tree without re-deriving state: SAN, destination squares, the resulting
  FEN, and the resulting status.
  """

  alias Echecs.{Board, Game, Move}

  @type move_info :: %{
          from: String.t(),
          to: String.t(),
          promotion: String.t() | nil,
          san: String.t(),
          fen: String.t(),
          status: String.t()
        }

  @doc """
  Returns the legal moves for a FEN position.

  Moves are unsorted; clients match them by `from`/`to` square.
  """
  @spec legal_moves(String.t()) :: {:ok, [move_info()]} | {:error, map()}
  def legal_moves(fen) when is_binary(fen) do
    try do
      game = Game.new(fen)
      {:ok, Enum.map(Echecs.legal_moves(game), &move_info(game, &1))}
    rescue
      _ -> {:error, %{reason: :invalid_fen}}
    end
  end

  def legal_moves(_), do: {:error, %{reason: :invalid_fen}}

  @doc """
  SAN for a legal move, including disambiguation and check/checkmate suffixes.
  """
  @spec san_for_move(Game.t(), Move.t(), Game.t()) :: String.t()
  def san_for_move(_game, %Move{special: special}, new_game)
      when special in [:kingside_castle, :queenside_castle] do
    base = if special == :kingside_castle, do: "O-O", else: "O-O-O"
    base <> suffix_for(new_game)
  end

  def san_for_move(game, move, new_game) do
    base =
      case Board.at(game.board, move.from) do
        {_, :pawn} -> pawn_san(move)
        {_, type} -> piece_san(game, move, type)
        nil -> ""
      end

    base <> suffix_for(new_game)
  end

  defp move_info(game, move) do
    new_game = Game.make_move(game, move)

    %{
      from: square_name(move.from),
      to: square_name(move.to),
      promotion: promotion_letter(move.promotion),
      san: san_for_move(game, move, new_game),
      fen: Echecs.FEN.to_string(new_game),
      status: status_name(new_game)
    }
  end

  defp pawn_san(move) do
    capture =
      if rem(move.from, 8) != rem(move.to, 8) do
        <<?a + rem(move.from, 8), "x">>
      else
        ""
      end

    capture <> square_name(move.to) <> promotion_suffix(move.promotion)
  end

  defp piece_san(game, move, type) do
    capture = if Board.at(game.board, move.to), do: "x", else: ""
    piece_letter(type) <> disambiguation(game, move) <> capture <> square_name(move.to)
  end

  defp disambiguation(game, move) do
    {_, type} = Board.at(game.board, move.from)

    rivals =
      Enum.filter(Echecs.legal_moves(game), fn candidate ->
        candidate.to == move.to and candidate.from != move.from and
          piece_type(game, candidate.from) == type
      end)

    case rivals do
      [] ->
        ""

      _ ->
        file = rem(move.from, 8)
        rank = 8 - div(move.from, 8)

        cond do
          Enum.any?(rivals, &(rem(&1.from, 8) == file)) and
              Enum.any?(rivals, &(8 - div(&1.from, 8) == rank)) ->
            <<?a + file, ?1 + rank - 1>>

          Enum.any?(rivals, &(rem(&1.from, 8) == file)) ->
            <<?1 + rank - 1>>

          true ->
            <<?a + file>>
        end
    end
  end

  defp piece_type(game, idx) do
    case Board.at(game.board, idx) do
      {_, type} -> type
      nil -> nil
    end
  end

  defp piece_letter(:knight), do: "N"
  defp piece_letter(:bishop), do: "B"
  defp piece_letter(:rook), do: "R"
  defp piece_letter(:queen), do: "Q"
  defp piece_letter(:king), do: "K"
  defp piece_letter(_), do: ""

  defp promotion_suffix(nil), do: ""

  defp promotion_suffix(promotion) do
    "=" <> promotion_letter(promotion)
  end

  defp promotion_letter(nil), do: nil
  defp promotion_letter(:queen), do: "Q"
  defp promotion_letter(:rook), do: "R"
  defp promotion_letter(:bishop), do: "B"
  defp promotion_letter(:knight), do: "N"

  defp suffix_for(new_game) do
    cond do
      Game.checkmate?(new_game) -> "#"
      Game.in_check?(new_game) -> "+"
      true -> ""
    end
  end

  defp status_name(game) do
    case Echecs.status(game) do
      :active -> "active"
      :checkmate -> "checkmate"
      :stalemate -> "stalemate"
      :draw -> "draw"
    end
  end

  defp square_name(idx) do
    <<?a + rem(idx, 8), ?1 + 7 - div(idx, 8)>>
  end
end
