defmodule Blunderfest.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      Blunderfest.Repo,
      Blunderfest.Storage,
      Blunderfest.Cache,
      Blunderfest.Telemetry,
      {DNSCluster, query: Application.get_env(:blunderfest, :dns_cluster_query) || fn -> :ok end},
      {Phoenix.PubSub, name: Blunderfest.PubSub},
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
