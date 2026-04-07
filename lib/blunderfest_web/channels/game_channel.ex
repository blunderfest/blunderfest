defmodule BlunderfestWeb.GameChannel do
  use Phoenix.Channel

  def join("game:" <> _game_id, _params, socket) do
    {:ok, socket}
  end

  def handle_in("move", %{"from" => _from, "to" => _to}, socket) do
    {:reply, :ok, socket}
  end
end
