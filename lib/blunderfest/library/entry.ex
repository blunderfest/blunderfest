defmodule Blunderfest.Library.Entry do
  @moduledoc """
  A saved game in the per-profile library (ADR-0020, ADR-0029): the full
  JSON-shaped tree, durable so the library finally crosses devices.
  """

  use Ecto.Schema

  @primary_key {:id, :string, autogenerate: false}
  schema "library_entries" do
    field(:profile_id, :string)
    field(:tree, :map)
    field(:saved_at, :utc_datetime_usec)
  end
end
