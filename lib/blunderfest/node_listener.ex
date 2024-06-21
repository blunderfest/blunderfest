defmodule Blunderfest.NodeListener do
  @moduledoc false

  use GenServer

  require Logger

  def start_link(_), do: GenServer.start_link(__MODULE__, [])

  def init(_) do
    :net_kernel.monitor_nodes(true, node_type: :visible)
    {:ok, nil}
  end

  def handle_info({:nodeup, _node, _node_type}, state) do
    set_members(Blunderfest.Registry)
    set_members(Blunderfest.DynamicSupervisor)

    join_state_handoff()

    {:noreply, state}
  end

  def handle_info({:nodedown, _node, _node_type}, state) do
    set_members(Blunderfest.Registry)
    set_members(Blunderfest.DynamicSupervisor)

    {:noreply, state}
  end

  defp set_members(name) do
    members =
      [Node.self() | Node.list()]
      |> tap(&Logger.info(inspect(&1)))
      |> Enum.map(fn node -> {name, node} end)

    :ok = Horde.Cluster.set_members(name, members)
  end

  defp join_state_handoff() do
    Node.list()
    |> tap(&Logger.info(inspect(&1)))
    |> Enum.map(&Blunderfest.StateHandoff.join/1)
  end
end
