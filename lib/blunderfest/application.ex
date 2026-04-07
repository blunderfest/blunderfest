defmodule Blunderfest.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    # Start telemetry handlers
    Blunderfest.Telemetry.start_link([])

    children = [
      Blunderfest.Storage,
      Blunderfest.Cache,
      Blunderfest.Endpoint
    ]

    opts = [strategy: :one_for_one, name: Blunderfest.Supervisor]
    Supervisor.start_link(children, opts)
  end

  @impl true
  def config_change(changed, _new, removed) do
    Blunderfest.Endpoint.config_change(changed, removed)
    :ok
  end
end
