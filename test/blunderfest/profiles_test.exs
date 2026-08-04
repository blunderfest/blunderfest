defmodule Blunderfest.ProfilesTest do
  use ExUnit.Case, async: false

  alias Blunderfest.Profiles

  setup do
    Profiles.reset()
    :ok
  end

  test "create returns a profile and a plaintext secret" do
    assert {:ok, profile, secret} = Profiles.create()
    assert profile.id != ""
    assert profile.name =~ ~r/^[A-Z][a-z]+ [A-Z][a-z]+ \d{2}$/
    assert secret != ""
  end

  test "create generates unique names" do
    names = for _ <- 1..20, do: elem(Profiles.create(), 1).name
    assert length(Enum.uniq(names)) == 20
  end

  test "get returns the profile by id" do
    {:ok, profile, _secret} = Profiles.create()
    assert {:ok, ^profile} = Profiles.get(profile.id)
  end

  test "get returns :error for an unknown id" do
    assert :error = Profiles.get("nope")
  end

  test "authenticate succeeds with the correct secret" do
    {:ok, profile, secret} = Profiles.create()
    assert Profiles.authenticate(profile.id, secret)
  end

  test "authenticate rejects a wrong secret" do
    {:ok, profile, _secret} = Profiles.create()
    refute Profiles.authenticate(profile.id, "wrong-secret")
  end

  test "authenticate rejects an unknown profile" do
    refute Profiles.authenticate("nope", "whatever")
  end

  test "reset empties the store" do
    {:ok, profile, _secret} = Profiles.create()
    Profiles.reset()
    assert :error = Profiles.get(profile.id)
  end
end
