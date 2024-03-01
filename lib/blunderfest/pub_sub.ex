defmodule Blunderfest.PubSub do
  alias BlunderfestWeb.Endpoint

  def broadcast_from(room_code, event, message) do
    Endpoint.broadcast_from(self(), topic(room_code), event, message)
  end

  def track(room_code, user_id) do
    Blunderfest.Presence.track_user(topic(room_code), user_id)
  end

  defp topic(room_code), do: "room:#{room_code}"
end
