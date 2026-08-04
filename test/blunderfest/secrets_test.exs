defmodule Blunderfest.SecretsTest do
  use ExUnit.Case, async: true

  alias Blunderfest.Secrets

  test "new_secret returns a URL-safe base64 string" do
    assert Secrets.new_secret() =~ ~r/^[A-Za-z0-9_-]{43}$/
  end

  test "two secrets differ" do
    refute Secrets.new_secret() == Secrets.new_secret()
  end

  test "hash never contains the plaintext secret" do
    secret = Secrets.new_secret()
    refute Secrets.hash(secret) =~ secret
  end

  test "hash is salted: same secret hashes differently each time" do
    secret = Secrets.new_secret()
    refute Secrets.hash(secret) == Secrets.hash(secret)
  end

  test "verify matches the hashed secret" do
    secret = Secrets.new_secret()
    assert Secrets.verify(secret, Secrets.hash(secret))
  end

  test "verify rejects a wrong secret" do
    refute Secrets.verify("wrong", Secrets.hash(Secrets.new_secret()))
  end

  test "verify rejects malformed stored values" do
    refute Secrets.verify(Secrets.new_secret(), "not-a-hash")
    refute Secrets.verify(Secrets.new_secret(), "")
  end
end
