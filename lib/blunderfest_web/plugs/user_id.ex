defmodule BlunderfestWeb.Plugs.UserId do
  import Plug.Conn

  def init(options), do: options

  def call(conn, _opts) do
    case get_session(conn, :user_id) do
      nil ->
        conn
        |> put_session(:user_id, Nanoid.generate())

      _ ->
        conn
    end
  end
end
