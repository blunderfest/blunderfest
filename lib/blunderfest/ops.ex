defmodule Blunderfest.Ops do
  @moduledoc """
  Validation for room ops arriving over the channel. The op log is the
  room's source of truth, so malformed payloads are rejected before they
  ever reach it: shape checks per op type plus size caps.
  """

  @max_op_bytes 262_144
  @max_fen_bytes 128
  @max_san_bytes 16
  @max_comment_bytes 2_000
  @max_chat_bytes 500
  @max_annotations 64
  @max_line_moves 64
  @max_tree_nodes 2_000
  @max_tree_depth 1_500

  @edit_op_types ~w(set_game move_at_ply replace_line add_line comment_at_ply set_annotations set_nags set_position)

  @square ~r/^[a-h][1-8]$/
  @color ~r/^#[0-9a-f]{6}$/

  @doc "Returns :ok when the op is well-formed, {:error, reason} otherwise."
  def validate(op) when is_map(op) do
    with {:ok, type} <- fetch_string(op, "type"),
         {:ok, payload} <- fetch_map(op, "payload"),
         :ok <- check_size(payload),
         :ok <- check_type(type, payload) do
      :ok
    end
  end

  def validate(_), do: {:error, :invalid_op}

  defp fetch_string(map, key) do
    case Map.get(map, key) do
      value when is_binary(value) -> {:ok, value}
      _ -> {:error, :invalid_op}
    end
  end

  defp fetch_map(map, key) do
    case Map.get(map, key) do
      value when is_map(value) -> {:ok, value}
      _ -> {:error, :invalid_op}
    end
  end

  defp check_size(payload) do
    if byte_size(Jason.encode!(payload)) <= @max_op_bytes, do: :ok, else: {:error, :op_too_large}
  end

  defp check_type("set_game", payload) do
    # The tree is a recursive structure that clients replay with recursive
    # walkers, so it gets a real shape check: every node needs an integer
    # id/ply and a children list, and the tree's size and depth are capped —
    # a 256 KB op can otherwise nest deep enough to overflow a client's call
    # stack on replay.
    case payload do
      %{"tree" => tree} -> if valid_game_tree?(tree), do: :ok, else: {:error, :invalid_op}
      _ -> {:error, :invalid_op}
    end
  end

  defp check_type("select_game", payload), do: string_field(payload, "game_id")

  defp check_type("set_cursor", payload), do: int_field(payload, "node_id")

  defp check_type("move_at_ply", payload) do
    # ply + san are required; the rest are validated when present (older
    # clients sent slimmer payloads).
    with :ok <- int_field(payload, "ply"),
         :ok <- string_field(payload, "san", @max_san_bytes),
         :ok <- optional_square(payload, "from"),
         :ok <- optional_square(payload, "to"),
         :ok <- optional_string(payload, "fen", @max_fen_bytes),
         :ok <- optional_string(payload, "status", 16),
         :ok <- optional_int(payload, "parent_id") do
      optional_string(payload, "promotion", 2)
    end
  end

  defp check_type("replace_line", payload) do
    with :ok <- int_field(payload, "ply"),
         :ok <- list_field(payload, "moves", 512) do
      :ok
    end
  end

  defp check_type("add_line", payload) do
    with :ok <- string_field(payload, "game_id"),
         :ok <- int_field(payload, "parent_id"),
         :ok <- list_field(payload, "moves", @max_line_moves),
         true <- Enum.all?(payload["moves"], &valid_line_move?/1) do
      :ok
    else
      _ -> {:error, :invalid_op}
    end
  end

  defp check_type("comment_at_ply", payload) do
    with :ok <- int_field(payload, "ply"),
         :ok <- string_field(payload, "text", @max_comment_bytes) do
      optional_int(payload, "node_id")
    end
  end

  defp check_type("set_position", payload) do
    with :ok <- string_field(payload, "fen", @max_fen_bytes) do
      int_field(payload, "parent_id")
    end
  end

  defp check_type("set_annotations", payload) do
    with :ok <- int_field(payload, "node_id"),
         :ok <- arrows_field(payload, "arrows"),
         :ok <- highlights_field(payload, "highlights") do
      :ok
    end
  end

  defp check_type("set_nags", payload) do
    with :ok <- string_field(payload, "game_id"),
         :ok <- int_field(payload, "node_id"),
         {:ok, nags} when is_list(nags) and length(nags) <= 8 <- Map.fetch(payload, "nags"),
         true <- Enum.all?(nags, &(is_integer(&1) and &1 >= 0 and &1 <= 255)) do
      :ok
    else
      _ -> {:error, :invalid_op}
    end
  end

  defp check_type("chat", payload), do: string_field(payload, "text", @max_chat_bytes)

  # Chat moderation (ADR-0023): the owner deletes a message by its op seq.
  defp check_type("delete_chat", payload), do: int_field(payload, "seq")

  defp check_type(_type, _payload), do: {:error, :invalid_op}

  @doc "Whether `tree` (JSON-shaped) is a structurally valid, safely bounded game tree."
  def valid_game_tree?(tree) when is_map(tree) do
    with :ok <- check_tree_fields(tree),
         {:ok, root} when is_map(root) <- Map.fetch(tree, "root"),
         {:ok, _node_count} <- walk_tree(root, 1, 0) do
      true
    else
      _ -> false
    end
  end

  def valid_game_tree?(_), do: false

  @doc "Whether an op payload counts as a room edit (moves, comments, etc.)."
  def edit_op?(%{"type" => type}) when type in @edit_op_types, do: true
  def edit_op?(%{"type" => type}) when is_binary(type), do: false
  def edit_op?(op) when is_map(op), do: op["type"] in @edit_op_types
  def edit_op?(_op), do: false

  defp check_tree_fields(tree) do
    with :ok <- optional_map(tree, "headers"),
         :ok <- optional_map(tree, "setup"),
         :ok <- optional_string(tree, "result", 16),
         :ok <- optional_int(tree, "mainline_ply_count") do
      optional_int(tree, "node_count")
    end
  end

  # Returns {:ok, node_count} or :error (bad shape, too many nodes, too deep).
  defp walk_tree(node, depth, count)
       when is_map(node) and depth <= @max_tree_depth and count < @max_tree_nodes do
    with %{"id" => id, "ply" => ply, "children" => children}
         when is_integer(id) and is_integer(ply) and is_list(children) <- node,
         :ok <-
           nullable_strings(node, ["san", "from", "to", "promotion", "comment", "status", "fen"]),
         :ok <- optional_list(node, "nags") do
      Enum.reduce_while(children, {:ok, count + 1}, fn child, {:ok, acc} ->
        case walk_tree(child, depth + 1, acc) do
          {:ok, acc} -> {:cont, {:ok, acc}}
          :error -> {:halt, :error}
        end
      end)
    else
      _ -> :error
    end
  end

  defp walk_tree(_node, _depth, _count), do: :error

  defp nullable_strings(map, keys) do
    if Enum.all?(keys, fn key ->
         case Map.get(map, key) do
           nil -> true
           value when is_binary(value) -> true
           _ -> false
         end
       end) do
      :ok
    else
      :error
    end
  end

  defp optional_map(map, key) do
    case Map.get(map, key) do
      nil -> :ok
      value when is_map(value) -> :ok
      _ -> :error
    end
  end

  defp optional_list(map, key) do
    case Map.get(map, key) do
      nil -> :ok
      value when is_list(value) -> :ok
      _ -> :error
    end
  end

  defp string_field(payload, key, max_bytes \\ 256) do
    case Map.get(payload, key) do
      value when is_binary(value) and byte_size(value) <= max_bytes -> :ok
      _ -> {:error, :invalid_op}
    end
  end

  defp optional_string(payload, key, max_bytes) do
    case Map.get(payload, key) do
      nil -> :ok
      value when is_binary(value) and byte_size(value) <= max_bytes -> :ok
      _ -> {:error, :invalid_op}
    end
  end

  defp int_field(payload, key) do
    case Map.get(payload, key) do
      value when is_integer(value) and value >= 0 -> :ok
      _ -> {:error, :invalid_op}
    end
  end

  defp optional_int(payload, key) do
    case Map.get(payload, key) do
      nil -> :ok
      value when is_integer(value) and value >= 0 -> :ok
      _ -> {:error, :invalid_op}
    end
  end

  defp optional_square(payload, key) do
    case Map.get(payload, key) do
      nil -> :ok
      value when is_binary(value) -> if value =~ @square, do: :ok, else: {:error, :invalid_op}
      _ -> {:error, :invalid_op}
    end
  end

  defp list_field(payload, key, max_len) do
    case Map.get(payload, key) do
      value when is_list(value) and length(value) <= max_len -> :ok
      _ -> {:error, :invalid_op}
    end
  end

  defp arrows_field(payload, key) do
    case Map.get(payload, key) do
      value when is_list(value) and length(value) <= @max_annotations ->
        if Enum.all?(value, &valid_arrow?/1), do: :ok, else: {:error, :invalid_op}

      _ ->
        {:error, :invalid_op}
    end
  end

  defp highlights_field(payload, key) do
    case Map.get(payload, key) do
      value when is_list(value) and length(value) <= @max_annotations ->
        if Enum.all?(value, &valid_highlight?/1), do: :ok, else: {:error, :invalid_op}

      _ ->
        {:error, :invalid_op}
    end
  end

  defp valid_arrow?(%{"from" => from, "to" => to, "color" => color}) do
    from =~ @square and to =~ @square and color =~ @color
  end

  defp valid_arrow?(_), do: false

  defp valid_highlight?(%{"square" => square, "color" => color}) do
    square =~ @square and color =~ @color
  end

  defp valid_highlight?(_), do: false

  defp valid_line_move?(move) when is_map(move) do
    string_field(move, "san", @max_san_bytes) == :ok and
      optional_square(move, "from") == :ok and
      optional_square(move, "to") == :ok and
      optional_string(move, "promotion", 2) == :ok and
      optional_string(move, "fen", @max_fen_bytes) == :ok and
      optional_string(move, "status", 16) == :ok
  end

  defp valid_line_move?(_), do: false
end
