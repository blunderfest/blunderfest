defmodule BlunderfestWeb.Plugs.UserId do
  import Plug.Conn

  def init(options), do: options

  def call(conn, _opts) do
    case conn.assigns[:user_token] do
      nil ->
        user_id = Nanoid.generate()
        token = Phoenix.Token.sign(conn, "user socket", user_id)

        conn
        |> assign(:user_token, token)

      _ ->
        conn
    end
  end
end
