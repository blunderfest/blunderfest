defmodule Blunderfest.Rooms do
  @moduledoc """
  In-memory room op logs. The authoritative state of a room is its operation
  log (`ops`): a monotonically increasing `seq` per room. State is rebuilt on
  boot, so a scale-to-zero instance loses nothing critical.

  Ops are JSON-shaped maps (`%{"type" => ..., "payload" => ...}`) coming from
  channel payloads; the store stamps them with `seq` and `ts`.
  """

  use GenServer

  @type op :: map()

  def start_link(opts) do
    GenServer.start_link(__MODULE__, %{}, name: Keyword.get(opts, :name, __MODULE__))
  end

  def ops(slug, server \\ __MODULE__) do
    GenServer.call(server, {:ops, slug})
  end

  def append(slug, op, server \\ __MODULE__) do
    GenServer.call(server, {:append, slug, op})
  end

  def reset(server \\ __MODULE__) do
    GenServer.call(server, :reset)
  end

  @impl true
  def init(_args) do
    {:ok, %{}}
  end

  @impl true
  def handle_call({:ops, slug}, _from, state) do
    {:reply, Map.get(state, slug, %{seq: 0, ops: []}).ops, state}
  end

  def handle_call({:append, slug, op}, _from, state) do
    room = Map.get(state, slug, %{seq: 0, ops: []})
    op = Map.merge(op, %{"seq" => room.seq + 1, "ts" => DateTime.utc_now()})
    room = %{room | seq: room.seq + 1, ops: room.ops ++ [op]}
    {:reply, op, Map.put(state, slug, room)}
  end

  def handle_call(:reset, _from, _state) do
    {:reply, :ok, %{}}
  end
end
