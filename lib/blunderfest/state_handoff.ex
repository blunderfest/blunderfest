defmodule Blunderfest.StateHandoff do
  @moduledoc """
  Module that transfers state amoung the cluster processes.
  """
  use GenServer

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, [], name: __MODULE__)
  end

  def join(node) do
    GenServer.call(__MODULE__, {:add_node, {__MODULE__, node}})
  end

  def handoff(state_id, state_details) do
    GenServer.call(__MODULE__, {:handoff, state_id, state_details})
  end

  def get_state_details(state_id) do
    GenServer.call(__MODULE__, {:get_state_details, state_id})
  end

  @impl true
  def init(_opts) do
    ## State handoff initiated
    {:ok, crdt_pid} = DeltaCrdt.start_link(DeltaCrdt.AWLWWMap)
    {:ok, crdt_pid}
  end

  @impl true
  def handle_call({:add_node, node_module}, _from, crdt_pid) do
    other_crdt_pid = GenServer.call(node_module, {:ack_add_node, crdt_pid})
    DeltaCrdt.set_neighbours(crdt_pid, [other_crdt_pid])
    {:reply, :ok, crdt_pid}
  end

  @impl true
  def handle_call({:ack_add_node, other_crdt_pid}, _from, crdt_pid) do
    DeltaCrdt.set_neighbours(crdt_pid, [other_crdt_pid])
    {:reply, crdt_pid, crdt_pid}
  end

  @impl true
  def handle_call({:handoff, state_id, state_details}, _from, crdt_pid) do
    DeltaCrdt.put(crdt_pid, state_id, state_details)
    {:reply, :ok, crdt_pid}
  end

  @impl true
  def handle_call({:get_state_details, state_id}, _from, crdt_pid) do
    details = DeltaCrdt.to_map(crdt_pid) |> Map.get(state_id)
    {:reply, details, crdt_pid}
  end
end
