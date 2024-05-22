defmodule BlunderfestWeb.RoomPresence do
  @moduledoc """
  Provides presence tracking to channels and processes.

  See the [`Phoenix.Presence`](https://hexdocs.pm/phoenix/Phoenix.Presence.html)
  docs for more details.
  """
  use Phoenix.Presence,
    otp_app: :blunderfest,
    pubsub_server: Blunderfest.PubSub

  def topic(room_code), do: "room:#{room_code}"
end
