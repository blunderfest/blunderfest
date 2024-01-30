defmodule Blunderfest.RoomSupervisor do
  use Horde.DynamicSupervisor

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

  def start_link(_) do
    Horde.DynamicSupervisor.start_link(__MODULE__, [strategy: :one_for_one], name: __MODULE__)
  end

  def init(init_arg) do
    [members: members()]
    |> Keyword.merge(init_arg)
    |> Horde.DynamicSupervisor.init()
  end

  def start_child(room_code) do
    child_spec = %{
      id: RoomServer,
      start: {RoomServer, :start_link, [room_code]},
      restart: :transient
    }

    Horde.DynamicSupervisor.start_child(__MODULE__, child_spec)
  end

  defp members() do
    Enum.map([Node.self() | Node.list()], &{__MODULE__, &1})
  end
end
