defmodule BlunderfestWeb.UserId do
  import Plug.Conn

  def init(options), do: options

  def call(conn, _opts) do
    case get_session(conn, :user_id) do
      nil ->
        user_id = Nanoid.generate()

        conn
        |> put_session(:user_id, user_id)

      _ ->
        conn
    end
  end
end
