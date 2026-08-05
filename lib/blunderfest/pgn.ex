defmodule Blunderfest.PGN do
  @moduledoc """
  PGN parsing into a variation tree (`Blunderfest.Game.Tree`).

  The parser is a small hand-rolled tokenizer + recursive descent builder.
  SAN resolution (disambiguation, en passant, promotions, check suffixes) is
  delegated to `Echecs`; castling is resolved from `Echecs.legal_moves/1`
  because `Echecs.PGN.move_from_san/2` only scans pseudo-legal moves.

  Recursive annotation variations (RAVs) after a move are resolved from the
  pre-move position when their first move is legal there (an alternative to
  the move itself), otherwise from the post-move position (an alternative to
  the continuation) — the standard disambiguation for `(1. d4 ...)` vs
  `(1...c5 ...)` blocks.
  """

  alias Blunderfest.Game.{Node, Tree}
  import Bitwise, only: [<<<: 2, &&&: 2]

  @result_tokens ["1-0", "0-1", "1/2-1/2", "*"]
  @max_pgn_bytes 256 * 1024

  @type error_detail :: map()

  @doc """
  Parses a PGN string into a game tree.

  Returns `{:ok, %Tree{}}` or `{:error, %{reason: atom(), ...}}` with a
  structured detail map for the API (never free-form prose).
  """
  @spec parse(binary()) :: {:ok, Tree.t()} | {:error, error_detail()}
  def parse(pgn) when is_binary(pgn) and byte_size(pgn) > @max_pgn_bytes,
    do: {:error, %{reason: :too_large}}

  def parse(pgn) when is_binary(pgn) do
    with {:ok, headers, movetext} <- split_headers(strip_bom(pgn)),
         {:ok, game, setup} <- initial_game(headers),
         {:ok, tokens} <- tokenize(movetext),
         {:ok, nodes, result, _rest} <- build_moves(tokens, game, 0) do
      result = result || Map.get(headers, "Result", "*")

      root = %Node{
        id: 0,
        ply: 0,
        san: nil,
        from: nil,
        to: nil,
        promotion: nil,
        comment: nil,
        nags: [],
        status: Echecs.status(game),
        children: nodes
      }

      if nodes == [] do
        {:error, %{reason: :no_moves}}
      else
        {:ok, %Tree{headers: headers, result: result, setup: setup, root: assign_ids(root)}}
      end
    end
  end

  ## Headers

  defp strip_bom(<<0xEF, 0xBB, 0xBF, rest::binary>>), do: rest
  defp strip_bom(pgn), do: pgn

  defp split_headers(pgn) do
    split_headers(pgn, %{})
  end

  defp split_headers(<<>>, headers), do: {:ok, headers, ""}

  defp split_headers(<<c, _::binary>> = pgn, headers) when c in [?\s, ?\t, ?\r, ?\n],
    do: split_headers(trim_leading(pgn), headers)

  defp split_headers(<<"[", rest::binary>>, headers) do
    case parse_header(rest, [], []) do
      {:ok, key, value, rest} ->
        split_headers(trim_leading(rest), Map.put(headers, key, value))

      :error ->
        {:error, %{reason: :invalid_header}}
    end
  end

  defp split_headers(movetext, headers), do: {:ok, headers, movetext}

  defp trim_leading(<<c, rest::binary>>) when c in [?\s, ?\t, ?\r, ?\n], do: trim_leading(rest)
  defp trim_leading(rest), do: rest

  defp parse_header(<<>>, _key, _value), do: :error

  defp parse_header(<<"\"", rest::binary>>, key_acc, _value_acc) do
    case read_quoted(rest, []) do
      {:ok, value, rest} ->
        rest = trim_leading(rest)

        case rest do
          <<"]", rest::binary>> -> {:ok, to_string(Enum.reverse(key_acc)), to_string(value), rest}
          _ -> :error
        end

      :error ->
        :error
    end
  end

  defp parse_header(<<c, rest::binary>>, key_acc, value_acc) when c in [?\s, ?\t, ?\r, ?\n] do
    parse_header(trim_leading(rest), key_acc, value_acc)
  end

  defp parse_header(<<c, rest::binary>>, key_acc, _value_acc) when c in 33..126 do
    parse_header(rest, [c | key_acc], [])
  end

  defp parse_header(_, _, _), do: :error

  defp read_quoted(<<>>, _acc), do: :error
  defp read_quoted(<<"\\\"", rest::binary>>, acc), do: read_quoted(rest, [?" | acc])
  defp read_quoted(<<"\\\\", rest::binary>>, acc), do: read_quoted(rest, [?\\ | acc])
  defp read_quoted(<<"\"", rest::binary>>, acc), do: {:ok, Enum.reverse(acc), rest}
  defp read_quoted(<<c, rest::binary>>, acc), do: read_quoted(rest, [c | acc])

  ## Setup

  defp initial_game(headers) do
    case {Map.get(headers, "Setup"), Map.get(headers, "FEN")} do
      {"1", nil} ->
        {:error, %{reason: :missing_fen}}

      {_, nil} ->
        {:ok, Echecs.new_game(), nil}

      {_, fen} ->
        try do
          {:ok, Echecs.new_game(fen), %{fen: fen}}
        rescue
          _ -> {:error, %{reason: :invalid_fen, fen: fen}}
        end
    end
  end

  ## Tokenizer

  defp tokenize(binary) do
    case scan(binary, []) do
      {:ok, tokens} -> {:ok, Enum.reverse(tokens)}
      {:error, _} = error -> error
    end
  end

  defp scan(<<>>, acc), do: {:ok, acc}
  defp scan(<<c, rest::binary>>, acc) when c in [?\s, ?\t, ?\r, ?\n], do: scan(rest, acc)

  defp scan(<<c, _::binary>> = bin, acc) when c in ?0..?9 do
    case result_scan(bin) do
      {:ok, token, rest} ->
        scan(rest, [token | acc])

      :error ->
        {digits, rest} = take_while(bin, &(&1 in ?0..?9))

        case rest do
          <<".", rest::binary>> ->
            {_dots, rest} = take_while(rest, &(&1 == ?.))
            scan(rest, [{:move_num, digits} | acc])

          _ ->
            {:error, %{reason: :unexpected_token, token: digits}}
        end
    end
  end

  defp scan(<<"(", rest::binary>>, acc), do: scan(rest, [{:rav_open, nil} | acc])

  defp scan(<<")", rest::binary>>, acc), do: scan(rest, [{:rav_close, nil} | acc])

  defp scan(<<"{", rest::binary>>, acc) do
    case read_comment(rest, []) do
      {:ok, comment, rest} -> scan(rest, [{:comment, comment} | acc])
      :error -> {:error, %{reason: :unterminated_comment}}
    end
  end

  defp scan(<<c, rest::binary>>, acc) when c in [?;, ?%] do
    {comment, rest} = take_until(rest, &(&1 in [?\r, ?\n]))
    scan(rest, [{:comment, comment} | acc])
  end

  defp scan(<<"$", rest::binary>>, acc) do
    {digits, rest} = take_while(rest, &(&1 in ?0..?9))

    case Integer.parse(digits) do
      {n, ""} when n >= 1 and n <= 255 -> scan(rest, [{:nag, n} | acc])
      _ -> {:error, %{reason: :invalid_nag, token: "$" <> digits}}
    end
  end

  defp scan(<<"*", rest::binary>>, acc), do: scan(rest, [{:result, "*"} | acc])

  defp scan(<<c, rest::binary>>, acc) when c in 33..126 do
    {token, rest} = take_while(<<c, rest::binary>>, &san_char?/1)
    scan(rest, [{:san, token} | acc])
  end

  defp scan(_, _), do: {:error, %{reason: :invalid_pgn}}

  defp result_scan(bin) do
    Enum.find_value(@result_tokens, fn token ->
      case bin do
        <<^token::binary, rest::binary>> -> {:ok, {:result, token}, rest}
        _ -> nil
      end
    end) || :error
  end

  defp san_char?(c), do: c in 33..126 and c not in [?(, ?), ?{, ?}, ?[, ?], ?;, ?$]

  defp read_comment(<<>>, _acc), do: :error
  defp read_comment(<<"\\}", rest::binary>>, acc), do: read_comment(rest, [?} | acc])
  defp read_comment(<<"}", rest::binary>>, acc), do: {:ok, to_string(Enum.reverse(acc)), rest}
  defp read_comment(<<c, rest::binary>>, acc), do: read_comment(rest, [c | acc])

  defp take_while(bin, pred), do: take_while(bin, pred, [])

  defp take_while(<<c, rest::binary>>, pred, acc) do
    if pred.(c),
      do: take_while(rest, pred, [c | acc]),
      else: {to_string(Enum.reverse(acc)), <<c, rest::binary>>}
  end

  defp take_while(<<>>, _pred, acc), do: {to_string(Enum.reverse(acc)), ""}

  defp take_until(bin, pred), do: take_until(bin, pred, [])

  defp take_until(<<c, rest::binary>>, pred, acc) do
    if pred.(c),
      do: {to_string(Enum.reverse(acc)), <<c, rest::binary>>},
      else: take_until(rest, pred, [c | acc])
  end

  defp take_until(<<>>, _pred, acc), do: {to_string(Enum.reverse(acc)), ""}

  ## Tree builder

  defp build_moves(tokens, game, ply) do
    case parse_moves(tokens, game, ply, %{pending: nil, result: nil}, {[], []}) do
      {:ok, nodes, alts, result, _rest} -> {:ok, nodes ++ alts, result, []}
      {:error, _} = error -> error
    end
  end

  defp parse_moves([], _game, _ply, st, {nodes, alts}),
    do: {:ok, Enum.reverse(nodes), Enum.reverse(alts), st.result, []}

  defp parse_moves([{:rav_close, _} | rest], _game, _ply, st, {nodes, alts}),
    do: {:ok, Enum.reverse(nodes), Enum.reverse(alts), st.result, rest}

  defp parse_moves([{:result, r} | _rest], _game, _ply, _st, {nodes, alts}),
    do: {:ok, Enum.reverse(nodes), Enum.reverse(alts), r, []}

  defp parse_moves([{:comment, c} | rest], game, ply, st, acc) do
    parse_moves(rest, game, ply, %{st | pending: merge_comment(st.pending, c)}, acc)
  end

  defp parse_moves([{:nag, n} | rest], game, ply, st, {nodes, alts}) do
    case nodes do
      [last | tail] ->
        parse_moves(rest, game, ply, st, {[%{last | nags: last.nags ++ [n]} | tail], alts})

      [] ->
        parse_moves(rest, game, ply, st, {nodes, alts})
    end
  end

  defp parse_moves([{:move_num, _} | rest], game, ply, st, acc) do
    parse_moves(rest, game, ply, st, acc)
  end

  defp parse_moves([{:rav_open, _} | rest], game, ply, st, {nodes, alts}) do
    case first_san(rest) do
      nil ->
        {_skipped, rest_after} = skip_rav_block(rest, 1)
        parse_moves(rest_after, game, ply, st, {nodes, alts})

      {:ok, _, _} ->
        {content, rest_after} = split_rav_block(rest)

        {:ok, rav_nodes, rav_alts, rav_result, _} =
          parse_moves(content, game, ply, %{pending: nil, result: nil}, {[], []})

        parse_moves(
          rest_after,
          game,
          ply,
          %{st | result: rav_result || st.result},
          {nodes ++ Enum.reverse(rav_nodes), alts ++ Enum.reverse(rav_alts)}
        )
    end
  end

  defp parse_moves([{:san, san} | rest], game, ply, st, {nodes, alts}) do
    if san == "e.p." do
      parse_moves(rest, game, ply, st, {nodes, alts})
    else
      case resolve_san(game, san) do
        {:error, reason} ->
          {:error, %{reason: reason, san: san, ply: ply + 1}}

        {:ok, move} ->
          new_game = Echecs.Game.make_move(game, move)

          node = %Node{
            ply: ply + 1,
            san: san,
            from: square_name(move.from),
            to: square_name(move.to),
            promotion: promotion_letter(move.promotion),
            comment: st.pending,
            nags: [],
            status: Echecs.status(new_game),
            children: []
          }

          {rest1, node} = attach_post_tokens(rest, node)

          {:ok, rav_from_game, alt_children, rav_result, rest2} =
            parse_ravs(rest1, game, new_game, ply, node.ply, {[], [], nil})

          {:ok, continuation, continuation_alts, result, rest3} =
            parse_moves(rest2, new_game, node.ply, st, {[], []})

          children =
            case continuation do
              [mainline | _] -> [mainline]
              [] -> []
            end

          node = %{node | children: children ++ alt_children ++ continuation_alts}

          parse_moves(
            rest3,
            game,
            ply,
            %{st | result: rav_result || result || st.result},
            {[node | nodes], Enum.reverse(rav_from_game) ++ alts}
          )
      end
    end
  end

  defp attach_post_tokens([{:comment, c} | rest], node) do
    attach_post_tokens(rest, %{node | comment: merge_comment(node.comment, c)})
  end

  defp attach_post_tokens([{:nag, n} | rest], node),
    do: attach_post_tokens(rest, %{node | nags: node.nags ++ [n]})

  defp attach_post_tokens(rest, node), do: {rest, node}

  defp parse_ravs([{:rav_open, _} | rest], game, new_game, ply, node_ply, {f, a, r}) do
    case first_san(rest) do
      nil ->
        {_skipped, rest_after} = skip_rav_block(rest, 1)
        parse_ravs(rest_after, game, new_game, ply, node_ply, {f, a, r})

      {:ok, first_san, _inner} ->
        {content, rest_after} = split_rav_block(rest)

        {from_game_nodes, alt_nodes, rav_result} =
          case resolve_san(game, first_san) do
            {:ok, _} ->
              {:ok, nodes, alts, res, _} =
                parse_moves(content, game, ply, %{pending: nil, result: nil}, {[], []})

              {nodes ++ alts, [], res}

            _ ->
              {:ok, nodes, alts, res, _} =
                parse_moves(content, new_game, node_ply, %{pending: nil, result: nil}, {[], []})

              {[], nodes ++ alts, res}
          end

        parse_ravs(rest_after, game, new_game, ply, node_ply, {
          f ++ from_game_nodes,
          a ++ alt_nodes,
          rav_result || r
        })
    end
  end

  defp parse_ravs(rest, _game, _new_game, _ply, _node_ply, {f, a, r}),
    do: {:ok, f, a, r, rest}

  defp first_san([{:san, san} | _]), do: {:ok, san, nil}

  defp first_san([{:rav_close, _} | _]), do: nil
  defp first_san([]), do: nil
  defp first_san([_ | rest]), do: first_san(rest)

  defp split_rav_block(tokens), do: split_rav_block(tokens, 1, [])

  defp split_rav_block([{:rav_open, _} | rest], depth, acc),
    do: split_rav_block(rest, depth + 1, [{:rav_open, nil} | acc])

  defp split_rav_block([{:rav_close, _} | rest], 1, acc),
    do: {Enum.reverse([{:rav_close, nil} | acc]), rest}

  defp split_rav_block([{:rav_close, _} | rest], depth, acc),
    do: split_rav_block(rest, depth - 1, [{:rav_close, nil} | acc])

  defp split_rav_block([token | rest], depth, acc),
    do: split_rav_block(rest, depth, [token | acc])

  defp split_rav_block([], _depth, acc), do: {Enum.reverse(acc), []}

  defp skip_rav_block([{:rav_open, _} | rest], depth), do: skip_rav_block(rest, depth + 1)

  defp skip_rav_block([{:rav_close, _} | rest], 1), do: {[], rest}

  defp skip_rav_block([{:rav_close, _} | rest], depth),
    do: skip_rav_block(rest, depth - 1)

  defp skip_rav_block([_ | rest], depth), do: skip_rav_block(rest, depth)
  defp skip_rav_block([], _depth), do: {[], []}

  ## SAN resolution

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
    prefix = if game.turn == :white, do: "w", else: "b"
    apply(Echecs.Board, String.to_atom(prefix <> String.downcase(letter)), [game.board])
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

  defp square_name(idx) do
    file = rem(idx, 8)
    rank = 8 - div(idx, 8)
    <<?a + file, ?1 + rank - 1>>
  end

  defp promotion_letter(nil), do: nil
  defp promotion_letter(:queen), do: "Q"
  defp promotion_letter(:rook), do: "R"
  defp promotion_letter(:bishop), do: "B"
  defp promotion_letter(:knight), do: "N"

  defp merge_comment(nil, c), do: c
  defp merge_comment(existing, c), do: existing <> "\n" <> c

  defp assign_ids(root) do
    {node, _state} = assign_ids(root, %{next: 1})
    node
  end

  defp assign_ids(node, state) do
    {children, state} =
      Enum.map_reduce(node.children, state, fn child, st ->
        child = %{child | id: st.next}
        assign_ids(child, %{st | next: st.next + 1})
      end)

    {%{node | children: children}, state}
  end
end
