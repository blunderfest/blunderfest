defmodule BlunderfestWeb.Plugs.UserId do
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
        |> assign(:user_id, user_id)

      _ ->
        conn
    end
  end
end
