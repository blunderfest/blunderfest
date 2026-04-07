defmodule BlunderfestWeb do
  @moduledoc """
  BlunderfestWeb keeps the contexts that define your domain
  and business logic.

  Contexts are also responsible for managing your data, whether
  it's in the database, or external services.
  """
  use Application

  @impl true
  def start(_type, _args) do
    import Supervisor.Spec, warn: false

    children = [
      # Start the endpoint when the application starts
      BlunderfestWeb.Endpoint
      # Starts a worker by calling: BlunderfestWeb.Worker.start_link(arg)
      # {BlunderfestWeb.Worker, arg}
    ]

    opts = [strategy: :one_for_one, name: BlunderfestWeb.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    BlunderfestWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
