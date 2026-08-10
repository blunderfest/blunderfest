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
  @max_annotations 64

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
    case payload do
      %{"tree" => %{"root" => _}} -> :ok
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

  defp check_type(_type, _payload), do: {:error, :invalid_op}

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
end
