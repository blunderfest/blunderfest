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

      # setup for clustering
      {Cluster.Supervisor, [topologies, [name: Blunderfest.ClusterSupervisor]]},
      # Start the registry for tracking running games
      {Horde.Registry, [name: Blunderfest.Registry, keys: :unique]},
      {Horde.DynamicSupervisor,
       [
         name: Blunderfest.DynamicSupervisor,
         shutdown: 10_000,
         strategy: :one_for_one
       ]},
      {Blunderfest.NodeListener, []},
      {Blunderfest.StateHandoff, []},

      # Start a worker by calling: Blunderfest.Worker.start_link(arg)
      # {Blunderfest.Worker, arg},
      # Start to serve requests, typically the last entry
      BlunderfestWeb.Endpoint
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Blunderfest.Supervisor]
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
