defmodule BlunderfestWeb.Plugs.UserId do
  import Plug.Conn

  def init(options), do: options

  def call(conn, _opts) do
    case conn.assigns[:user_token] do
      nil ->
        IO.puts("Assign new token")
        user_id = Nanoid.generate()
        IO.puts("User id generated: #{user_id}")
        token = Phoenix.Token.sign(conn, "user socket", user_id)
        IO.puts("Token generated: #{token}")

        conn
        |> assign(:user_token, token)

      _ ->
        conn
    end
  end
end
