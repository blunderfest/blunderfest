defmodule Blunderfest.Application do
  # See https://elixir.hexdocs.pm/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      Blunderfest.Profiles,
      # Per-profile game library (ADR-0020): saved game trees, session-scoped.
      Blunderfest.Library,
      # Fixed-window rate limiter for anonymous room creation.
      Blunderfest.RateLimit,
      # One process per room (ADR-0012), distributed across the cluster
      # (ADR-0013): rooms register by slug in the Horde Registry and are
      # started on demand under the Horde DynamicSupervisor on some node;
      # membership follows DNSCluster (`members: :auto`).
      {Horde.Registry, keys: :unique, name: Blunderfest.RoomRegistry, members: :auto},
      {Horde.DynamicSupervisor,
       name: Blunderfest.RoomSupervisor, strategy: :one_for_one, members: :auto},
      {DNSCluster, query: Application.get_env(:blunderfest, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Blunderfest.PubSub},
      BlunderfestWeb.Presence,
      # Evicts idle, empty rooms so the room cap can't be exhausted by
      # abandoned ones. After Presence: it reads it.
      BlunderfestWeb.RoomSweeper,
      BlunderfestWeb.Endpoint
    ]

    # See https://elixir.hexdocs.pm/Supervisor.html
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
