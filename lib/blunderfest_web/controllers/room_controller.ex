defmodule BlunderfestWeb.RoomController do
  use BlunderfestWeb, :controller

  alias Blunderfest.{DemoRoom, Profiles, RateLimit, Rooms}

  @doc """
  Explicitly creates a room for `code`. The first profiled creator becomes
  the room's owner; anonymous creators are not recorded. Rooms are never
  created implicitly by joining. The demo code is reserved: the demo room
  is seeded by the server (read-only), never through this endpoint. Creation
  is rate-limited per client IP (ADR-0017).

  An optional `tree` seeds the room with a game on creation (the library
  "open in a new room" flow, ADR-0020) — validated like any `set_game`.
  """
  def create(conn, %{"code" => code} = params) do
    with :ok <- check_code(code),
         :ok <- check_not_reserved(code),
         :ok <- check_rate_limit(conn),
         :ok <- check_tree(params),
         {:ok, profile_id} <- creator_profile_id(conn, params["profile_id"]) do
      case Rooms.create(code, profile_id) do
        :ok ->
          maybe_seed(code, profile_id, params["tree"])

          conn
          |> put_status(:created)
          |> json(%{code: code})

        {:error, :room_limit} ->
          conn
          |> put_status(:too_many_requests)
          |> json(%{errors: %{code: "room_limit"}})
      end
    else
      {:error, code} ->
        conn
        |> put_status(status_for(code))
        |> json(%{errors: %{code: code}})
    end
  end

  def create(conn, _params) do
    conn
    |> put_status(:unprocessable_entity)
    |> json(%{errors: %{code: "invalid_code"}})
  end

  # The creator may attach their profile; it is honoured when the bearer
  # secret matches. A mismatched secret is rejected (the client re-heals its
  # profile and retries) rather than silently creating an ownerless room.
  defp creator_profile_id(conn, profile_id) when is_binary(profile_id) do
    with ["Bearer " <> secret] <- get_req_header(conn, "authorization"),
         true <- Profiles.authenticate(profile_id, secret) do
      {:ok, profile_id}
    else
      _ -> {:error, "unauthorized"}
    end
  end

  defp creator_profile_id(_conn, _profile_id), do: {:ok, "anonymous"}

  # Fly's proxy sets Fly-Client-IP; locally we see the peer directly.
  defp client_ip(conn) do
    case get_req_header(conn, "fly-client-ip") do
      [ip | _] -> ip
      [] -> conn.remote_ip |> :inet.ntoa() |> to_string()
    end
  end

  defp check_code(code) do
    if Rooms.valid_code?(code), do: :ok, else: {:error, "invalid_code"}
  end

  defp check_not_reserved(code) do
    if DemoRoom.reserved?(code), do: {:error, "code_reserved"}, else: :ok
  end

  defp check_rate_limit(conn) do
    if RateLimit.hit(client_ip(conn)) == :deny, do: {:error, "rate_limited"}, else: :ok
  end

  defp check_tree(%{"tree" => tree}) when is_map(tree) do
    if Blunderfest.Ops.valid_game_tree?(tree), do: :ok, else: {:error, "invalid_tree"}
  end

  defp check_tree(%{"tree" => _}), do: {:error, "invalid_tree"}
  defp check_tree(_), do: :ok

  defp maybe_seed(code, profile_id, tree) when is_map(tree) do
    # Seed only a fresh room: re-creating an existing slug keeps its state.
    if Rooms.ops(code) == [] do
      Rooms.append(code, %{
        "type" => "set_game",
        "author" => profile_id,
        "payload" => %{"game_id" => game_id(), "tree" => tree}
      })
    end
  end

  defp maybe_seed(_code, _profile_id, _tree), do: :ok

  defp game_id, do: Base.url_encode64(:crypto.strong_rand_bytes(8), padding: false)

  defp status_for("rate_limited"), do: :too_many_requests
  defp status_for("unauthorized"), do: :unauthorized
  defp status_for(_code), do: :unprocessable_entity
end
