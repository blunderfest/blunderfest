defmodule BlunderfestWeb.Presence do
  @moduledoc """
  Presence tracker for rooms. Meta carries the member's profile name.
  """

  use Phoenix.Presence,
    otp_app: :blunderfest,
    pubsub_server: Blunderfest.PubSub

  def fetch(_topic, presences) do
    Map.new(presences, fn {key, %{metas: metas}} ->
      {key, %{metas: Enum.map(metas, &Map.take(&1, [:name]))}}
    end)
  end
end
