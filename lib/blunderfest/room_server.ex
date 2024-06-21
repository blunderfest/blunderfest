defmodule Blunderfest.RoomServer do
  @moduledoc false
  alias Blunderfest.Core.Room

  # Node.connect(:"node2@127.0.0.1")

  use GenServer
  require Logger

  @impl GenServer
  def init(room_code) do
    Process.flag(:trap_exit, true)

    {:ok, Room.new(room_code), {:continue, :load_state}}
  end

  @impl GenServer
  def terminate(reason, %Room{} = state) do
    Logger.info("Terminating because of #{reason}")
    Logger.info("Saving #{inspect(state)}")

    Blunderfest.StateHandoff.handoff(state.room_code, state)
  end

  @impl GenServer
  def handle_continue(:load_state, %Room{} = state) do
    Logger.info("Loading #{state.room_code}")

    state =
      Blunderfest.StateHandoff.get_state_details(state.room_code)
      |> get_state_from_store(state)

    Logger.info("Found state #{inspect(state)}")

    {:noreply, state}
  end

  def start(room_code) do
    Horde.DynamicSupervisor.start_child(
      Blunderfest.DynamicSupervisor,
      {Blunderfest.RoomServer, [room_code: room_code]}
    )
  end

  def terminate(room_code) do
    pid = whereis(room_code)

    Horde.DynamicSupervisor.terminate_child(Blunderfest.DynamicSupervisor, pid)
  end

  def child_spec(opts) do
    room_code = Keyword.get(opts, :room_code)

    %{
      id: "#{__MODULE__}_#{room_code}",
      start: {__MODULE__, :start_link, [room_code]},
      shutdown: 5_000,
      restart: :transient
    }
  end

  def start_link(room_code) do
    case GenServer.start_link(__MODULE__, room_code,
           name: Blunderfest.Registry.via_tuple(room_code)
         ) do
      {:ok, pid} ->
        {:ok, pid}

      {:error, {:already_started, pid}} ->
        Logger.info("#{room_code} already started at #{inspect(pid)}")
        {:already_started, pid}
    end
  end

  def whereis(room_code) do
    room_code
    |> Blunderfest.Registry.via_tuple()
    |> GenServer.whereis()
  end

  defp get_state_from_store(nil, old_state), do: old_state
  defp get_state_from_store(state, _old_state), do: state
end
