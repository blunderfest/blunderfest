defmodule Blunderfest.Telemetry do
  use GenServer

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, [], name: __MODULE__)
  end

  def init(_opts) do
    :telemetry.attach_many(
      "blunderfest-handler",
      [
        [:blunderfest, :repo, :query],
        [:blunderfest, :endpoint, :start],
        [:blunderfest, :endpoint, :stop],
        [:blunderfest, :game, :add],
        [:blunderfest, :game, :get],
        [:blunderfest, :position, :lookup],
        [:blunderfest, :search, :execute]
      ],
      &__MODULE__.handle_event/4,
      %{}
    )

    :ok
  end

  def handle_event([:blunderfest, :repo, :query], measurements, metadata, _config) do
    :telemetry.execute(
      [:blunderfest, :repo, :query, :duration],
      %{duration: measurements.duration},
      metadata
    )
  end

  def handle_event([:blunderfest, :endpoint, :start], measurements, metadata, _config) do
    :telemetry.execute(
      [:blunderfest, :endpoint, :request, :duration],
      %{duration: measurements.duration},
      metadata
    )
  end

  def handle_event([:blunderfest, :endpoint, :stop], measurements, metadata, _config) do
    :telemetry.execute(
      [:blunderfest, :endpoint, :request, :duration],
      %{duration: measurements.duration},
      metadata
    )
  end

  def handle_event([:blunderfest, :game | _] = event, measurements, metadata, _config) do
    :telemetry.execute(
      [:blunderfest | event] ++ [:duration],
      %{duration: measurements.duration},
      metadata
    )
  end

  def handle_event([:blunderfest, :position | _] = event, measurements, metadata, _config) do
    :telemetry.execute(
      [:blunderfest | event] ++ [:duration],
      %{duration: measurements.duration},
      metadata
    )
  end

  def handle_event([:blunderfest, :search | _] = event, measurements, metadata, _config) do
    :telemetry.execute(
      [:blunderfest | event] ++ [:duration],
      %{duration: measurements.duration},
      metadata
    )
  end
end
