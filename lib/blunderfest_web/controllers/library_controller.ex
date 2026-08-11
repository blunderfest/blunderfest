defmodule BlunderfestWeb.LibraryController do
  @moduledoc """
  The per-profile game library (ADR-0020): save a game tree, list entries,
  delete one. All routes are bearer-authed against the profile's device
  secret, like `GET /api/profiles/:id`.
  """

  use BlunderfestWeb, :controller

  alias Blunderfest.{Library, Profiles}

  def index(conn, %{"id" => id}) do
    with :ok <- authorize(conn, id) do
      json(conn, %{entries: Library.list(id)})
    else
      {:error, :unauthorized} -> unauthorized(conn)
    end
  end

  def create(conn, %{"id" => id}) do
    with :ok <- authorize(conn, id),
         {:ok, tree} <- fetch_tree(conn.body_params),
         {:ok, entry} <- Library.save(id, tree) do
      conn
      |> put_status(:created)
      |> json(%{entry: Map.take(entry, [:id, :title, :saved_at])})
    else
      {:error, :unauthorized} -> unauthorized(conn)
      {:error, :invalid_request} -> invalid_request(conn)
      {:error, :invalid_tree} -> error(conn, :unprocessable_entity, "invalid_tree")
      {:error, :tree_too_large} -> error(conn, :request_entity_too_large, "tree_too_large")
      {:error, :library_full} -> error(conn, :unprocessable_entity, "library_full")
    end
  end

  def delete(conn, %{"id" => id, "entry_id" => entry_id}) do
    with :ok <- authorize(conn, id) do
      Library.delete(id, entry_id)
      json(conn, %{})
    else
      {:error, :unauthorized} -> unauthorized(conn)
    end
  end

  defp authorize(conn, profile_id) do
    with ["Bearer " <> secret] <- get_req_header(conn, "authorization"),
         true <- Profiles.authenticate(profile_id, secret) do
      :ok
    else
      _ -> {:error, :unauthorized}
    end
  end

  defp fetch_tree(%{"tree" => tree}) when is_map(tree), do: {:ok, tree}
  defp fetch_tree(_), do: {:error, :invalid_request}

  defp unauthorized(conn) do
    conn
    |> put_status(:unauthorized)
    |> json(%{errors: %{code: "unauthorized"}})
  end

  defp invalid_request(conn) do
    conn
    |> put_status(:bad_request)
    |> json(%{errors: %{code: "invalid_request"}})
  end

  defp error(conn, status, code) do
    conn
    |> put_status(status)
    |> json(%{errors: %{code: code}})
  end
end
