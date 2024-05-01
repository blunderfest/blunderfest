defmodule BlunderfestWeb.RoomController do
  use BlunderfestWeb, :controller

  def index(
        conn,
        %{"room_code" => room_code} = _params
      ) do
    user_id = Nanoid.generate()

    conn
    |> assign(:user_token, generate_user_token(conn, user_id))
    |> assign(:user_id, user_id)
    |> assign(:room_code, room_code)
    |> render(:index, layout: false)
  end

  def index(conn, _params) do
    room_code = Nanoid.generate()
    conn |> redirect(to: ~p"/#{room_code}")
  end

  defp generate_user_token(conn, user_id) do
    Phoenix.Token.sign(conn, Application.fetch_env!(:blunderfest, :token_salt), user_id)
  end
end
