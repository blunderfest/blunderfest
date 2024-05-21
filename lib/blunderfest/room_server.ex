defmodule Blunderfest.RoomServer do
  @timeout 60 * 60 * 1000

  use GenServer

  require Logger

  def child_spec(name) do
    %{
      id: name,
      start: {__MODULE__, :start_link, [name]},
      shutdown: 10_000,
      restart: :transient
    }
  end

  def start_link(name) do
    case GenServer.start_link(__MODULE__, [], name: via_tuple(name)) do
      {:ok, pid} ->
        {:ok, pid}

      {:error, {:already_started, pid}} ->
        Logger.info("already started at #{inspect(pid)}, returning :ignore")
        :ignore

      {:error, reason} ->
        Logger.info("Could not start GenServer, because #{inspect(reason)}")
        :ignore
    end
  end

  def exists?(name) do
    instances = Horde.Registry.lookup(Blunderfest.Registry, name)

    Logger.info("Found #{inspect(instances)} for #{name}")

    instances
    |> Enum.empty?()
    |> Kernel.not()
  end

  def init(_args) do
    {:ok, nil}
  end

  def terminate(reason, _state) do
    Logger.info("terminating: #{inspect(self())}: #{inspect(reason)}")
    :ok
  end

  def via_tuple(name), do: {:via, Horde.Registry, {Blunderfest.Registry, name}}
end
