defmodule BlunderfestWeb.UserSocket do
  @moduledoc """
  The channel socket for real-time collaboration.

  Anonymous by design: the socket itself carries no identity. Rooms learn
  who's there from the channel-join params (`profile_id`, `name`), matched
  against the profile the client already holds.
  """
  use Phoenix.Socket

  # Channel routes are registered as features land:
  channel "room:*", BlunderfestWeb.RoomChannel

  def connect(_params, socket, _connect_info) do
    {:ok, socket}
  end

  def id(_socket), do: nil
end
