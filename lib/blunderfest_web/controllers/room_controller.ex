defmodule BlunderfestWeb.RoomController do
  use BlunderfestWeb, :controller

  alias Blunderfest.{Profiles, Rooms}

  @doc """
  Explicitly creates a room for `code`. The first profiled creator becomes
  the room's owner; anonymous creators are not recorded. Rooms are never
  created implicitly by joining.
  """
  def create(conn, %{"code" => code}) do
    if Rooms.valid_code?(code) do
      profile_id = creator_profile_id(conn, conn.body_params["profile_id"])

      case Rooms.create(code, profile_id) do
        :ok ->
          conn
          |> put_status(:created)
          |> json(%{code: code})

        {:error, :room_limit} ->
          conn
          |> put_status(:too_many_requests)
          |> json(%{errors: %{code: "room_limit"}})
      end
    else
      conn
      |> put_status(:unprocessable_entity)
      |> json(%{errors: %{code: "invalid_code"}})
    end
  end

  def create(conn, _params) do
    conn
    |> put_status(:unprocessable_entity)
    |> json(%{errors: %{code: "invalid_code"}})
  end

  # The creator may attach their profile; it is only honoured when the bearer
  # secret matches, otherwise the room is created anonymously.
  defp creator_profile_id(conn, profile_id) when is_binary(profile_id) do
    with ["Bearer " <> secret] <- get_req_header(conn, "authorization"),
         true <- Profiles.authenticate(profile_id, secret) do
      profile_id
    else
      _ -> "anonymous"
    end
  end

  defp creator_profile_id(_conn, _profile_id), do: "anonymous"
end
