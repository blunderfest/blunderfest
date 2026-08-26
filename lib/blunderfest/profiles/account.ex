defmodule Blunderfest.Profiles.Account do
  @moduledoc """
  A linked external identity (ADR-0022): a lichess account bound to a
  profile as a recovery key and data source, never a persona. One row
  per `{profile_id, type}`; `{type, username}` is globally unique — an
  account maps to exactly one profile.
  """

  use Ecto.Schema

  schema "accounts" do
    field(:profile_id, :string)
    field(:type, :string)
    field(:username, :string)
    field(:access_token, :string)
    field(:scopes, {:array, :string}, default: [])
    field(:linked_at, :utc_datetime_usec)
  end
end
