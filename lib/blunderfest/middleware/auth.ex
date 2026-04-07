defmodule Blunderfest.Middleware.Auth do
  @moduledoc """
  Authentication middleware for API requests.
  """

  import Plug.Conn
  import Phoenix.Controller, only: [json: 2]

  def init(opts), do: opts

  def call(conn, _opts) do
    api_key = get_req_header(conn, "authorization") |> List.first()

    case validate_api_key(api_key) do
      {:ok, tier} ->
        assign(conn, :api_tier, tier)

      {:error, :missing} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{success: false, error: %{code: "UNAUTHORIZED", message: "Missing API key"}})
        |> halt()

      {:error, :invalid} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{success: false, error: %{code: "UNAUTHORIZED", message: "Invalid API key"}})
        |> halt()
    end
  end

  defp validate_api_key(nil), do: {:error, :missing}

  defp validate_api_key("Bearer " <> key) do
    # In production, validate against database
    if String.length(key) == 32 do
      {:ok, :basic}
    else
      {:error, :invalid}
    end
  end

  defp validate_api_key(_), do: {:error, :invalid}
end
