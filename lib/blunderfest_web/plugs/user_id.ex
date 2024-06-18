defmodule BlunderfestWeb.UserId do
  @moduledoc """
  Ensures a user id in the assigns.
  """

  import Plug.Conn

  def init(options), do: options

  def call(conn, _opts) do
    case conn.assigns[:user_token] do
      nil ->
        user_id = Nanoid.generate()

        token =
          Phoenix.Token.sign(conn, Application.fetch_env!(:blunderfest, :token_salt), user_id)

        conn
        |> assign(:user_token, token)

      _ ->
        conn
    end
  end
end
