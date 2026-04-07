defmodule BlunderfestWeb.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      BlunderfestWeb.Telemetry,
      {DNSCluster, query: Application.get_env(:blunderfest_web, :dns_cluster_query) || :ignore},
      {Finch, name: BlunderfestWeb.Finch},
      BlunderfestWeb.Endpoint
    ]

    opts = [strategy: :one_for_one, name: BlunderfestWeb.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
