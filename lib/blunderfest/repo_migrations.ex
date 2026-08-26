defmodule Blunderfest.RepoMigrations do
  @moduledoc """
  Runs the application-data migrations at boot, before the app serves
  anything (ADR-0029): deploys self-migrate, and the advisory lock Ecto
  takes when `migration_lock` is configured makes the two-node cluster's
  simultaneous boots safe.
  """

  use GenServer

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    path = Application.app_dir(:blunderfest, "priv/repo/migrations")

    # Ecto.Migrator.run takes the advisory migration lock itself
    # (`migration_lock` defaults on), so both cluster nodes may boot at
    # once — one runs the migrations, the other waits.
    Ecto.Migrator.run(Blunderfest.Repo, path, :up, all: true)

    {:ok, %{}}
  end
end
