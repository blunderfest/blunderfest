defmodule BlunderfestApi do
  @moduledoc """
  BlunderfestApi keeps the contexts that define your domain
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
      BlunderfestApi.Endpoint
      # Starts a worker by calling: BlunderfestApi.Worker.start_link(arg)
      # {BlunderfestApi.Worker, arg}
    ]

    opts = [strategy: :one_for_one, name: BlunderfestApi.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    BlunderfestApi.Endpoint.config_change(changed, removed)
    :ok
  end
end
