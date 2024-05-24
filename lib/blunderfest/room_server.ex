defmodule Blunderfest.RoomServer do
  @timeout 60 * 60 * 1000

  use GenServer

  require Logger

  def child_spec(room_code) do
    %{
      id: room_code,
      start: {__MODULE__, :start_link, [room_code]},
      shutdown: 10_000,
      restart: :transient
    }
  end

  def start_link(room_code) do
    case GenServer.start_link(__MODULE__, [room_code], name: via_tuple(room_code)) do
      {:ok, pid} -> {:ok, pid}
      {:error, {:already_started, pid}} -> {:ok, pid}
      result -> result
    end
  end

  def exists?(room_code),
    do:
      Horde.Registry.lookup(Blunderfest.Registry, room_code)
      |> Enum.empty?()
      |> Kernel.not()

  @impl true
  def init(room_code) do
    {:ok, room_code, @timeout}
  end

  @impl true
  def terminate(reason, _state) do
    Logger.info("terminating: #{inspect(self())}: #{inspect(reason)}")
    :ok
  end

  @impl true
  def handle_info(:timeout, state) do
    {:stop, :normal, state}
  end

  def via_tuple(room_code), do: {:via, Horde.Registry, {Blunderfest.Registry, room_code}}
end
