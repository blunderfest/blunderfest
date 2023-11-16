defmodule Blunderfest.Game.IdGenerator do
  alias Nanoid

  @type id :: String.t()

  @spec generate() :: id()
  def generate(),
    do: Nanoid.generate(12, "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")
end
