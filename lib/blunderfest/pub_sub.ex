defmodule Blunderfest.PubSub do
  def subscribe(room_code) do
    Phoenix.PubSub.subscribe(Blunderfest.PubSub, topic(room_code))
  end

  def broadcast_from(room_code, message) do
    Phoenix.PubSub.broadcast_from(Blunderfest.PubSub, self(), topic(room_code), message)
  end

  def track(room_code, user_id) do
    Blunderfest.Presence.track_user(topic(room_code), user_id)
  end

  defp topic(room_code), do: "room:#{room_code}"
end
