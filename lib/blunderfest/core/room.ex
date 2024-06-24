defmodule Blunderfest.Core.Room do
  @moduledoc false

  alias __MODULE__

  @derive Jason.Encoder
  defstruct [:room_code, :timestamp]

  def new(room_code), do: %Room{room_code: room_code, timestamp: :os.system_time(:millisecond)}
end
