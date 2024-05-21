defmodule Blunderfest.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    topologies = Application.get_env(:libcluster, :topologies) || []

    children = [
      BlunderfestWeb.Telemetry,
      {Phoenix.PubSub, name: Blunderfest.PubSub},
      {Cluster.Supervisor, [topologies, [name: Blunderfest.ClusterSupervisor]]},
      # Start the Finch HTTP client for sending emails
      {Finch, name: Blunderfest.Finch},
      # Start a worker by calling: Blunderfest.Worker.start_link(arg)
      # {Blunderfest.Worker, arg},
      # Start to serve requests, typically the last entry
      {Horde.Registry, [name: Blunderfest.Registry, keys: :unique, members: :auto]},
      {Horde.DynamicSupervisor,
       [name: Blunderfest.Supervisor, strategy: :one_for_one, members: :auto]},
      BlunderfestWeb.Endpoint
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one]
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
