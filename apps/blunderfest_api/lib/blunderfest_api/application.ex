defmodule BlunderfestApi.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      BlunderfestApi.Telemetry,
      {DNSCluster, query: Application.get_env(:blunderfest_api, :dns_cluster_query) || :ignore},
      {Finch, name: BlunderfestApi.Finch},
      BlunderfestApi.Endpoint
    ]

    opts = [strategy: :one_for_one, name: BlunderfestApi.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
