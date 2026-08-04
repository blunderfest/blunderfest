defmodule BlunderfestWeb.ProfileController do
  use BlunderfestWeb, :controller

  alias Blunderfest.Profiles

  def create(conn, _params) do
    case Profiles.create() do
      {:ok, profile, secret} ->
        conn
        |> put_status(:created)
        |> json(%{profile: profile_json(profile), secret: secret})
    end
  end

  def show(conn, %{"id" => id}) do
    case authenticated_profile(conn, id) do
      {:ok, profile} -> json(conn, %{profile: profile_json(profile)})
      :error -> unauthorized(conn)
    end
  end

  defp authenticated_profile(conn, id) do
    with {:ok, secret} <- bearer_secret(conn),
         true <- Profiles.authenticate(id, secret),
         {:ok, profile} <- Profiles.get(id) do
      {:ok, profile}
    else
      _ -> :error
    end
  end

  defp bearer_secret(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> secret] -> {:ok, secret}
      _ -> :error
    end
  end

  defp unauthorized(conn) do
    conn
    |> put_status(:unauthorized)
    |> json(%{errors: %{code: "unauthorized"}})
  end

  defp profile_json(profile) do
    %{id: profile.id, name: profile.name, created_at: profile.created_at}
  end
end
