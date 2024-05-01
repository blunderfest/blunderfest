defmodule BlunderfestWeb.RoomController do
  alias Blunderfest.Rooms
  use BlunderfestWeb, :controller

  def index(
        conn,
        %{"room_code" => room_code} = _params
      ) do
    if Rooms.exists?(room_code) do
      conn
      |> ensure_user()
      |> assign(:room_code, room_code)
      |> render(:index, layout: false)
    else
      conn
      |> redirect(to: ~p"/")
    end
  end

  def index(conn, _params) do
    with {:ok, room_code} <- Rooms.create(), do: conn |> redirect(to: ~p"/#{room_code}")
  end

  defp ensure_user(%{assigns: %{user_token: _user_token}} = conn), do: conn

  defp ensure_user(conn) do
    user_id = Nanoid.generate()
    token = conn |> generate_user_token(user_id)

    conn
    |> assign(:user_token, token)
    |> assign(:user_id, user_id)
  end

  defp generate_user_token(conn, user_id) do
    Phoenix.Token.sign(conn, Application.fetch_env!(:blunderfest, :token_salt), user_id)
  end
end
