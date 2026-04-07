defmodule Blunderfest do
  @moduledoc """
  Blunderfest is a high-performance, distributed chess database engine.
  """
  alias Blunderfest.{
    Chess.Board,
    Chess.Move,
    Chess.Zobrist,
    Chess.FEN,
    Chess.SAN,
    Game,
    Position,
    Player,
    Storage.Database,
    Storage.PositionIndex,
    Storage.Segment,
    Analysis.Opening,
    Analysis.Stats
  }

  @doc """
  Returns the application version.
  """
  def version, do: "0.1.0"

  @doc """
  Initializes a new database (admin only).
  """
  defdelegate initialize(uri), to: Database, as: :create

  @doc """
  Connects to an existing database.
  """
  defdelegate connect(uri, opts \\ []), to: Database, as: :open

  @doc """
  Disconnects from the database.
  """
  defdelegate disconnect(db), to: Database

  @doc """
  Gets database information.
  """
  defdelegate database_info(db), to: Database, as: :info
end
