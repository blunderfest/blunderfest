defmodule Blunderfest.Registry do
  @moduledoc false

  use Horde.Registry

  require Logger

  def start_link(_) do
    Horde.Registry.start_link(__MODULE__, [keys: :unique], name: __MODULE__)
  end

  def init(init_arg) do
    members()
    |> Keyword.merge(init_arg)
    |> Horde.Registry.init()
  end

  def via_tuple(room_code), do: {:via, Horde.Registry, {Blunderfest.Registry, room_code}}

  defp members() do
    [Node.self() | Node.list()]
    |> tap(&Logger.info(inspect(&1)))
    |> Enum.map(&{__MODULE__, &1})
  end
end
