defmodule BlunderfestWeb.UserSocket do
  @moduledoc """
  The channel socket for real-time collaboration.

  Authentication is anonymous by design: clients may present an optional
  device token (a Phoenix.Token-signed value) to claim a stable identity, but
  joining never requires one.
  """
  use Phoenix.Socket

  # Channel routes are registered as features land:
  #   channel "room:*", BlunderfestWeb.RoomChannel

  def connect(_params, socket, _connect_info) do
    {:ok, socket}
  end

  def id(_socket), do: nil
end
