defmodule Blunderfest.NodeInfo do
  @moduledoc """
  This node's Fly region (`FLY_REGION`), or `"local"` outside Fly (dev,
  tests). Room processes carry it as their registry value, so any node can
  answer "which region hosts this room?" with a local registry read.
  """

  @doc "This node's region."
  def region do
    System.get_env("FLY_REGION") || "local"
  end
end
