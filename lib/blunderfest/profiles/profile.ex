defmodule Blunderfest.Profiles.Profile do
  @moduledoc false

  # A profile is the fun-name display identity (ADR-0004). `secret_hashes`
  # holds one salted hash per device secret — signing in on a new device
  # adds a hash without invalidating the old ones (User 1..n Account,
  # ADR-0022). `accounts` links external identities (lichess): recovery
  # keys and data sources, never a persona.
  defstruct id: nil,
            name: nil,
            secret_hashes: [],
            created_at: nil,
            accounts: []
end
