defmodule BlunderfestWeb.UserSocket do
  use Phoenix.Socket

  channel "game:*", BlunderfestWeb.GameChannel

  def connect(_params, socket, _opts) do
    {:ok, socket}
  end

  def id(_socket), do: nil
end
