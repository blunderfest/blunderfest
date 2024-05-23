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

  def track_user(room_code, user_id) do
    IO.inspect(self())
    track(self(), topic(room_code), room_code, %{user_id: user_id})
  end

  def list_users(room_code) do
    topic = topic(room_code)

    case list(topic) do
      %{^room_code => %{metas: list}} -> list
      _other -> []
    end
  end
end
