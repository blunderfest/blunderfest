defmodule Blunderfest.NodeInfo do
  @moduledoc """
  This node's Fly region (`FLY_REGION`), or `"local"` outside Fly (dev,
  tests). Sent to clients in the health check and the room-join reply, so
  the UI can show which region you're talking to.
  """

  @doc "This node's region."
  def region do
    System.get_env("FLY_REGION") || "local"
  end
end
