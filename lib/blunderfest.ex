defmodule Blunderfest do
  @moduledoc """
  Blunderfest is a high-performance, distributed chess database engine.
  """

  @doc """
  Returns the application version.
  """
  def version, do: "0.1.0"

  @doc """
  Initializes a new database (admin only).
  """
  defdelegate initialize(uri), to: Blunderfest.Storage.Database, as: :create

  @doc """
  Connects to an existing database.
  """
  defdelegate connect(uri, opts \\ []), to: Blunderfest.Storage.Database, as: :open

  @doc """
  Disconnects from the database.
  """
  defdelegate disconnect(db), to: Blunderfest.Storage.Database

  @doc """
  Gets database information.
  """
  defdelegate database_info(db), to: Blunderfest.Storage.Database, as: :info
end
