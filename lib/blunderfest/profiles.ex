defmodule Blunderfest.Profiles do
  @moduledoc """
  Durable anonymous profiles (ADR-0004, ADR-0029). No PII — a profile is
  an id, a server-generated name, the salted hashes of its device
  secrets, and its linked external accounts. Backed by `Blunderfest.Repo`,
  so a profile survives deploys and is the same on every cluster region
  (the in-memory predecessor's split-brain is gone).
  """

  import Ecto.Query

  alias Blunderfest.Profiles.{Account, Name, Profile}
  alias Blunderfest.Repo
  alias Blunderfest.Secrets

  @name_attempts 5

  @doc "Creates a profile and returns it with the plaintext device secret."
  def create do
    secret = Secrets.new_secret()

    profile = %Profile{
      id: new_id(),
      name: Name.generate(),
      secret_hashes: [Secrets.hash(secret)],
      created_at: DateTime.utc_now(),
      accounts: []
    }

    with {:ok, profile} <- insert_with_unique_name(profile, @name_attempts) do
      {:ok, profile, secret}
    end
  end

  def get(id) do
    case Repo.get(Profile, id) do
      nil -> :error
      profile -> {:ok, with_accounts(profile)}
    end
  end

  def authenticate(id, secret) do
    case Repo.get(Profile, id) do
      nil -> false
      profile -> Enum.any?(profile.secret_hashes, &Secrets.verify(secret, &1))
    end
  end

  @doc """
  Links (or refreshes) an external account on the profile (ADR-0022).
  One account per type per profile; `{type, username}` is unique
  globally. `account` is `%{type: "lichess", username, token, scopes,
  linked_at}`.
  """
  def link_account(id, account) do
    case Repo.get(Profile, id) do
      nil ->
        {:error, :not_found}

      profile ->
        attrs = %{
          profile_id: id,
          type: account.type,
          username: account.username,
          access_token: account.token,
          scopes: account.scopes,
          linked_at: account.linked_at
        }

        case Repo.get_by(Account, profile_id: id, type: account.type) do
          nil -> Repo.insert!(struct!(Account, attrs))
          row -> Repo.update!(Ecto.Changeset.change(row, attrs))
        end

        {:ok, with_accounts(profile)}
    end
  end

  @doc "Finds the profile linked to an external account. `{:error, :not_found}` otherwise."
  def profile_by_account(type, username) do
    case Repo.get_by(Account, type: type, username: username) do
      nil -> {:error, :not_found}
      account -> get(account.profile_id)
    end
  end

  @doc "Detaches an external account (and its token) from the profile."
  def unlink_account(id, type) do
    case Repo.get(Profile, id) do
      nil ->
        {:error, :not_found}

      profile ->
        from(a in Account, where: a.profile_id == ^id and a.type == ^type)
        |> Repo.delete_all()

        {:ok, with_accounts(profile)}
    end
  end

  @doc """
  Issues an additional device secret for an existing profile — how a
  recovered identity reaches a new device (ADR-0022). Older secrets keep
  working.
  """
  def issue_secret(id) do
    case Repo.get(Profile, id) do
      nil ->
        {:error, :not_found}

      profile ->
        secret = Secrets.new_secret()
        hashes = [Secrets.hash(secret) | profile.secret_hashes]
        {:ok, updated} = Repo.update(Ecto.Changeset.change(profile, secret_hashes: hashes))
        {:ok, with_accounts(updated), secret}
    end
  end

  @doc "Drops every profile (test seam)."
  def reset do
    Repo.delete_all(Profile)
    :ok
  end

  # The display name is globally unique; a collision (same name drawn
  # twice) just redraws. The unique index enforces it concurrently.
  defp insert_with_unique_name(_profile, 0), do: {:error, :name_conflict}

  defp insert_with_unique_name(profile, attempts) do
    case Repo.insert(profile) do
      {:ok, _} -> {:ok, profile}
      {:error, _} -> insert_with_unique_name(%{profile | name: Name.generate()}, attempts - 1)
    end
  end

  defp with_accounts(profile) do
    accounts =
      from(a in Account, where: a.profile_id == ^profile.id, order_by: [desc: a.linked_at])
      |> Repo.all()
      |> Enum.map(fn account ->
        %{
          type: account.type,
          username: account.username,
          token: account.access_token,
          scopes: account.scopes,
          linked_at: account.linked_at
        }
      end)

    %{profile | accounts: accounts}
  end

  defp new_id do
    :crypto.strong_rand_bytes(16)
    |> Base.url_encode64(padding: false)
  end
end
