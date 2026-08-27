defmodule BlunderfestWeb.Presence do
  @moduledoc """
  Presence tracker for rooms. Meta carries the member's profile name.
  """

  use Phoenix.Presence,
    otp_app: :blunderfest,
    pubsub_server: Blunderfest.PubSub

  # The metas keep :phx_ref: clients match metas by ref when applying
  # presence diffs (phoenix.js Presence) — one member holding two tabs must
  # not vanish when a single tab closes. Stripping the ref made every meta
  # identical (undefined), so any tab's departure removed the whole member.
  def fetch(_topic, presences) do
    Map.new(presences, fn {key, %{metas: metas}} ->
      {key, %{metas: Enum.map(metas, &Map.take(&1, [:phx_ref, :name]))}}
    end)
  end
end
