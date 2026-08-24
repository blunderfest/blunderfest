defmodule Blunderfest.Corpus.Replay do
  @moduledoc """
  Lean mainline replay of a PGN movetext using echecs (port of Spike 02's
  replay machinery).

  Unlike `Blunderfest.PGN` (which builds full variation trees with comments,
  NAGs, per-node FENs and statuses for the rooms feature), this replays only
  the played mainline: comments, NAGs, move numbers and recursive annotation
  variations are skipped at the byte level, and no tree is built. That is the
  right shape for corpus extraction — played positions only — and much
  cheaper per game.

  SAN resolution follows the same strategy as `Blunderfest.PGN`:
  `Echecs.PGN.move_from_san/2` first (it resolves disambiguation, promotions
  and check suffixes), with a legal-move scan as fallback for castling and
  tricky disambiguation.
  """

  import Bitwise, only: [<<<: 2, &&&: 2]

  @doc """
  Replays a movetext from `game` (usually the initial position).

  Returns `{:ok, states}` where `states` is the list of game states after
  each mainline ply, in play order (state after ply 1 first), or
  `{:error, reason, san}` when a SAN fails to resolve.
  """
  @spec replay(Echecs.Game.t(), binary()) :: {:ok, [Echecs.Game.t()]} | {:error, term(), binary()}
  def replay(%Echecs.Game{} = game, movetext) when is_binary(movetext) do
    movetext
    |> scan_sans()
    |> then(&apply_sans(game, &1, []))
  end

  defp apply_sans(_game, [], acc), do: {:ok, Enum.reverse(acc)}

  defp apply_sans(game, [san | rest], acc) do
    case resolve_san(game, san) do
      {:ok, move} ->
        new_game = Echecs.Game.make_move(game, move)
        apply_sans(new_game, rest, [new_game | acc])

      {:error, reason} ->
        {:error, reason, san}
    end
  end

  @doc """
  Tokenizes a movetext into the mainline SAN move list, skipping comments
  (`{...}`, `;` or `%` to end-of-line), NAGs (`$42`), move numbers, results,
  and recursive annotation variations (skipped with a depth counter).
  """
  @spec scan_sans(binary()) :: [binary()]
  def scan_sans(bin) when is_binary(bin), do: scan(bin, 0, []) |> Enum.reverse()

  defp scan(<<>>, _depth, acc), do: acc

  defp scan(<<c, rest::binary>>, depth, acc) when c in [?\s, ?\t, ?\r, ?\n],
    do: scan(rest, depth, acc)

  defp scan(<<"{", rest::binary>>, depth, acc), do: scan(skip_comment(rest), depth, acc)

  defp scan(<<c, rest::binary>>, depth, acc) when c in [?;, ?%],
    do: scan(skip_to_eol(rest), depth, acc)

  defp scan(<<"(", rest::binary>>, depth, acc), do: scan(rest, depth + 1, acc)
  defp scan(<<")", rest::binary>>, depth, acc), do: scan(rest, max(depth - 1, 0), acc)

  defp scan(<<"$", rest::binary>>, depth, acc) do
    {_digits, rest} = take_digits(rest)
    scan(rest, depth, acc)
  end

  defp scan(<<c, _::binary>> = bin, depth, acc) when c in ?0..?9 do
    {_digits, rest} = take_digits(bin)

    case rest do
      <<".", rest2::binary>> ->
        scan(skip_dots(rest2), depth, acc)

      _ ->
        # A result token (1-0, 0-1, 1/2-1/2) ends the game: anything after
        # it is not part of the mainline; anything else is garbage we skip
        # byte-wise.
        case result_token(bin) do
          {:ok, _rest} -> acc
          :error -> scan(skip_one(rest), depth, acc)
        end
    end
  end

  defp scan(<<"*", rest::binary>>, depth, acc), do: scan(rest, depth, acc)

  defp scan(<<c, rest::binary>>, depth, acc) when c in 33..126 do
    {token, rest2} = take_token(<<c, rest::binary>>)
    if depth == 0, do: scan(rest2, depth, [token | acc]), else: scan(rest2, depth, acc)
  end

  defp scan(<<_c, rest::binary>>, depth, acc), do: scan(rest, depth, acc)

  defp result_token(bin) do
    Enum.find_value(["1-0", "0-1", "1/2-1/2"], fn tok ->
      case bin do
        <<^tok::binary, rest::binary>> -> {:ok, rest}
        _ -> nil
      end
    end) || :error
  end

  defp skip_comment(<<"}", rest::binary>>), do: rest
  defp skip_comment(<<_, rest::binary>>), do: skip_comment(rest)
  defp skip_comment(<<>>), do: <<>>

  defp skip_to_eol(<<c, rest::binary>>) when c in [?\r, ?\n], do: rest
  defp skip_to_eol(<<_, rest::binary>>), do: skip_to_eol(rest)
  defp skip_to_eol(<<>>), do: <<>>

  defp skip_dots(<<".", rest::binary>>), do: skip_dots(rest)
  defp skip_dots(rest), do: rest

  defp skip_one(<<_, rest::binary>>), do: rest
  defp skip_one(<<>>), do: <<>>

  defp take_digits(bin), do: take_prefix(bin, &(&1 in ?0..?9))

  defp take_token(bin), do: take_prefix(bin, &token_char?/1)

  defp token_char?(c), do: c in 33..126 and c not in [?(, ?), ?{, ?}, ?;, ?$]

  defp take_prefix(bin, pred) do
    n = count_prefix(bin, pred, 0)
    {binary_part(bin, 0, n), binary_part(bin, n, byte_size(bin) - n)}
  end

  defp count_prefix(<<c, rest::binary>>, pred, n) do
    if pred.(c), do: count_prefix(rest, pred, n + 1), else: n
  end

  defp count_prefix(<<>>, _pred, n), do: n

  ## SAN resolution (ported from Blunderfest.PGN)

  defp resolve_san(game, san) do
    san = String.replace(san, ~r/[!?]+$/, "")
    san = String.replace(san, "0-0", "O-O")

    cond do
      san in ["O-O", "O-O-O"] ->
        special = if san == "O-O", do: :kingside_castle, else: :queenside_castle

        case Enum.find(Echecs.legal_moves(game), &(&1.special == special)) do
          nil -> {:error, :illegal_castling}
          move -> {:ok, move}
        end

      san == "" ->
        {:error, :empty_san}

      true ->
        case Echecs.PGN.move_from_san(game, san) do
          {:ok, move} ->
            {:ok, move}

          {:error, reason} ->
            case parse_san_parts(san) do
              {:ok, piece, file, rank, target, promotion}
              when not is_nil(file) or not is_nil(rank) ->
                candidates =
                  Enum.filter(Echecs.legal_moves(game), fn m ->
                    m.to == square_index(target) and
                      from_matches?(game, m, piece, file, rank) and
                      promotion_matches?(m.promotion, promotion)
                  end)

                case candidates do
                  [move] -> {:ok, move}
                  [] -> {:error, reason}
                  _ -> {:error, :ambiguous_move}
                end

              _ ->
                {:error, reason}
            end
        end
    end
  end

  defp parse_san_parts(san) do
    case Regex.run(~r/^([NBRQK])?([a-h])?([1-8])?(x)?([a-h][1-8])(=[NBRQ])?[+#]?$/, san) do
      [_, piece, file, rank, _capture, target, promotion] ->
        {:ok, nilify(piece), nilify(file), nilify(rank), target, nilify(promotion)}

      _ ->
        :error
    end
  end

  defp nilify(""), do: nil
  defp nilify(v), do: v

  defp from_matches?(game, move, piece, file, rank) do
    from_file = rem(move.from, 8)
    from_rank = 8 - div(move.from, 8)
    file_ok = is_nil(file) or <<?a + from_file>> == file
    rank_ok = is_nil(rank) or from_rank == String.to_integer(rank)

    bitboard = piece_bitboard(game, piece || "P")
    piece_ok = (bitboard &&& 1 <<< move.from) != 0

    file_ok and rank_ok and piece_ok
  end

  defp piece_bitboard(game, letter) do
    case {game.turn, letter} do
      {:white, "P"} -> Echecs.Board.wp(game.board)
      {:white, "N"} -> Echecs.Board.wn(game.board)
      {:white, "B"} -> Echecs.Board.wb(game.board)
      {:white, "R"} -> Echecs.Board.wr(game.board)
      {:white, "Q"} -> Echecs.Board.wq(game.board)
      {:white, "K"} -> Echecs.Board.wk(game.board)
      {:black, "P"} -> Echecs.Board.bp(game.board)
      {:black, "N"} -> Echecs.Board.bn(game.board)
      {:black, "B"} -> Echecs.Board.bb(game.board)
      {:black, "R"} -> Echecs.Board.br(game.board)
      {:black, "Q"} -> Echecs.Board.bq(game.board)
      {:black, "K"} -> Echecs.Board.bk(game.board)
    end
  end

  defp square_index(<<file, rank>>) do
    (8 - (rank - ?0)) * 8 + (file - ?a)
  end

  defp promotion_matches?(nil, nil), do: true

  defp promotion_matches?(actual, expected) when not is_nil(expected) do
    letter =
      case actual do
        :queen -> "Q"
        :rook -> "R"
        :bishop -> "B"
        :knight -> "N"
      end

    letter == expected
  end

  defp promotion_matches?(_, _), do: false
end
