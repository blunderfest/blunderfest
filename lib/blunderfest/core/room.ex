defmodule Blunderfest.Core.Room do
  @moduledoc false

  alias __MODULE__

  @derive Jason.Encoder
  defstruct [:room_code]

  def new(room_code), do: %Room{room_code: room_code}
end
