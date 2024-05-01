defmodule BlunderfestWeb.Presence do
  use Phoenix.Presence, otp_app: :blunderfest, pubsub_server: Blunderfest.PubSub
end
