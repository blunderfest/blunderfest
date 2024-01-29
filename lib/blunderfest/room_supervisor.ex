defmodule Blunderfest.RoomSupervisor do
  use DynamicSupervisor

  alias Blunderfest.Core.RoomServer

  @spec create() :: {:error, any()} | {:ok, String.t()}
  def create() do
    room_code = Nanoid.generate()

    case start_child(room_code) do
      {:ok, _} -> {:ok, room_code}
      {:error, {:already_started, _pid}} -> {:ok, room_code}
      {:error, error} -> {:error, error}
    end
  end

  defp start_child(room_code) do
    child_spec = %{
      id: RoomServer,
      start: {RoomServer, :start_link, [room_code]},
      restart: :transient
    }

    DynamicSupervisor.start_child(__MODULE__, child_spec)
  end

  @impl true
  def init(_init_arg) do
    DynamicSupervisor.init(strategy: :one_for_one)
  end
end
