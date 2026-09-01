defmodule Blunderfest.Profiles.Profile do
  @moduledoc """
  The durable anonymous profile (ADR-0004, ADR-0029): a fun-name display
  identity, the salted hashes of the device secrets that prove it, and
  the linked external accounts. `secret_hashes` holds one salted hash
  per device secret — signing in on a new device adds a hash without
  invalidating the old ones (ADR-0022). `accounts` is a virtual field:
  the account rows live in their own table and are loaded alongside.
  """

  use Ecto.Schema

  @primary_key {:id, :string, autogenerate: false}
  schema "profiles" do
    field(:name, :string)
    field(:secret_hashes, {:array, :string}, default: [])
    field(:created_at, :utc_datetime_usec)
    field(:accounts, {:array, :map}, virtual: true, default: [])
  end

  @type t :: %__MODULE__{}
end
