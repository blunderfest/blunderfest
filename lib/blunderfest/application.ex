defmodule Blunderfest.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    topologies = Application.get_env(:libcluster, :topologies) || []

    children = [
      # Start the Telemetry supervisor
      BlunderfestWeb.Telemetry,
      # Start the PubSub system
      {Phoenix.PubSub, name: Blunderfest.PubSub},
      # Start Finch
      {Finch, name: Blunderfest.Finch},
      # setup for clustering
      {Cluster.Supervisor, [topologies, [name: Blunderfest.ClusterSupervisor]]},
      # Start the Endpoint (http/https)
      BlunderfestWeb.Endpoint,
      BlunderfestWeb.Presence,
      {Horde.Registry, [name: Blunderfest.Registry, keys: :unique]},
      {Horde.DynamicSupervisor,
       [name: Blunderfest.DynamicSupervisor, strategy: :one_for_one, members: :auto]}
      # Start a worker by calling: Blunderfest.Worker.start_link(arg)
      # {Blunderfest.Worker, arg}
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
