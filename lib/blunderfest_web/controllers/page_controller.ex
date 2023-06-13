defmodule BlunderfestWeb.PageController do
  use BlunderfestWeb, :controller
  alias Nanoid

  def join(conn, %{"code" => code}) do
    conn
    |> assign(:room_code, code)
    |> render(:index, layout: false)
  end

  def index(conn, _params), do: conn |> start_new_game()

  defp start_new_game(conn) do
    code = Nanoid.generate(12, "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")

    conn
    |> redirect(to: ~p"/#{code}")
    |> halt()
  end
end
