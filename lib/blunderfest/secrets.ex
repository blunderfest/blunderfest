defmodule Blunderfest.Secrets do
  @moduledoc """
  Device secrets: random tokens issued once and verified later via salted hashes.

  The plaintext secret is returned to the client exactly once, at profile
  creation. The server only ever stores `salt:digest` — never the secret itself.
  """

  @secret_bytes 32
  @salt_bytes 16

  def new_secret do
    :crypto.strong_rand_bytes(@secret_bytes)
    |> Base.url_encode64(padding: false)
  end

  def hash(secret) do
    salt = :crypto.strong_rand_bytes(@salt_bytes)
    digest = :crypto.hash(:sha256, salt <> secret)
    Base.encode64(salt) <> ":" <> Base.encode64(digest)
  end

  def verify(secret, stored) do
    case String.split(stored, ":") do
      [salt_b64, digest_b64] ->
        salt = Base.decode64!(salt_b64)
        digest = Base.decode64!(digest_b64)
        computed = :crypto.hash(:sha256, salt <> secret)
        Plug.Crypto.secure_compare(computed, digest)

      _ ->
        false
    end
  end
end
