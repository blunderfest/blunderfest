defmodule Blunderfest.Repo.Migrations.CreateAppDataTables do
  use Ecto.Migration

  @moduledoc """
  The application-data schema (ADR-0029): durable anonymous profiles,
  linked external accounts, and the per-profile game library.
  """

  def change do
    create table(:profiles, primary_key: false) do
      add(:id, :string, primary_key: true)
      add(:name, :string, null: false)
      add(:secret_hashes, {:array, :string}, null: false, default: [])
      add(:created_at, :utc_datetime_usec, null: false)
    end

    create(unique_index(:profiles, [:name]))

    create table(:accounts) do
      add(:profile_id, references(:profiles, type: :string, on_delete: :delete_all), null: false)
      add(:type, :string, null: false)
      add(:username, :string, null: false)
      add(:access_token, :string)
      add(:scopes, {:array, :string}, null: false, default: [])
      add(:linked_at, :utc_datetime_usec, null: false)
    end

    create(unique_index(:accounts, [:type, :username]))

    create table(:library_entries, primary_key: false) do
      add(:id, :string, primary_key: true)
      add(:profile_id, references(:profiles, type: :string, on_delete: :delete_all), null: false)
      add(:tree, :map, null: false)
      add(:saved_at, :utc_datetime_usec, null: false)
    end

    create(index(:library_entries, [:profile_id, :saved_at]))
  end
end
