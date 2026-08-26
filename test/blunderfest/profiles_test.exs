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
    assert {:ok, loaded} = Profiles.get(profile.id)
    assert loaded.id == profile.id
    assert loaded.name == profile.name
    assert loaded.secret_hashes == profile.secret_hashes
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

  describe "linked accounts" do
    defp lichess_account(username \\ "dr_ny") do
      %{
        type: "lichess",
        username: username,
        token: "tok",
        scopes: ["study:read"],
        linked_at: DateTime.utc_now()
      }
    end

    test "link_account attaches the account and upserts by type" do
      {:ok, profile, _secret} = Profiles.create()

      {:ok, _} = Profiles.link_account(profile.id, lichess_account())
      {:ok, _} = Profiles.link_account(profile.id, lichess_account("dr_ny_2"))

      {:ok, updated} = Profiles.get(profile.id)
      assert [%{username: "dr_ny_2"}] = updated.accounts
    end

    test "link_account fails for an unknown profile" do
      assert {:error, :not_found} = Profiles.link_account("nope", lichess_account())
    end

    test "profile_by_account finds the linked profile, else :not_found" do
      {:ok, profile, _secret} = Profiles.create()
      {:ok, _} = Profiles.link_account(profile.id, lichess_account())

      assert {:ok, found} = Profiles.profile_by_account("lichess", "dr_ny")
      assert found.id == profile.id
      assert {:error, :not_found} = Profiles.profile_by_account("lichess", "someone_else")
      assert {:error, :not_found} = Profiles.profile_by_account("chesscom", "dr_ny")
    end

    test "unlink_account detaches the account" do
      {:ok, profile, _secret} = Profiles.create()
      {:ok, _} = Profiles.link_account(profile.id, lichess_account())

      assert {:ok, updated} = Profiles.unlink_account(profile.id, "lichess")
      assert updated.accounts == []
      assert {:error, :not_found} = Profiles.profile_by_account("lichess", "dr_ny")
      assert {:error, :not_found} = Profiles.unlink_account("nope", "lichess")
    end
  end

  describe "issue_secret" do
    test "adds a working secret without invalidating the old one" do
      {:ok, profile, first} = Profiles.create()

      assert {:ok, _updated, second} = Profiles.issue_secret(profile.id)
      assert second != first
      assert Profiles.authenticate(profile.id, first)
      assert Profiles.authenticate(profile.id, second)
    end

    test "fails for an unknown profile" do
      assert {:error, :not_found} = Profiles.issue_secret("nope")
    end
  end
end
