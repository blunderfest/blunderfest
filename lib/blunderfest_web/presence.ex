defmodule BlunderfestWeb.Presence do
  use Phoenix.Presence,
    otp_app: :blunderfest,
    pubsub_server: Blunderfest.PubSub

  def track_user(topic, user_id) do
    track(self(), topic, user_id, %{user_id: user_id})
  end

  def list_users(topic) do
    topic
    |> list()
    |> Enum.map(fn {_user_id, data} -> data[:metas] |> List.first() end)
  end
end
