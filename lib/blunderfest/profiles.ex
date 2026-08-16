defmodule Blunderfest.Profiles do
  @moduledoc """
  In-memory store of anonymous profiles. No PII — a profile is an id, a
  server-generated name, and a salted hash of the device secret. State is
  rebuilt on boot, so a scale-to-zero instance loses nothing critical.
  """

  use GenServer

  alias Blunderfest.Profiles.{Name, Profile}
  alias Blunderfest.Secrets

  def start_link(opts) do
    GenServer.start_link(__MODULE__, nil, name: Keyword.get(opts, :name, __MODULE__))
  end

  @impl true
  def init(nil), do: {:ok, %{profiles: %{}, names: MapSet.new()}}

  def create(server \\ __MODULE__) do
    GenServer.call(server, :create)
  end

  def get(id, server \\ __MODULE__) do
    GenServer.call(server, {:get, id})
  end

  def authenticate(id, secret, server \\ __MODULE__) do
    GenServer.call(server, {:authenticate, id, secret})
  end

  @doc """
  Links (or refreshes) an external account on the profile (ADR-0022).
  `account` is `%{type: "lichess", username, token, scopes, linked_at}`.
  """
  def link_account(id, account, server \\ __MODULE__) do
    GenServer.call(server, {:link_account, id, account})
  end

  @doc "Finds the profile linked to an external account. `{:error, :not_found}` otherwise."
  def profile_by_account(type, username, server \\ __MODULE__) do
    GenServer.call(server, {:profile_by_account, type, username})
  end

  @doc """
  Issues an additional device secret for an existing profile — how a
  recovered identity reaches a new device (ADR-0022). Older secrets keep
  working.
  """
  def issue_secret(id, server \\ __MODULE__) do
    GenServer.call(server, {:issue_secret, id})
  end

  def reset(server \\ __MODULE__) do
    GenServer.call(server, :reset)
  end

  @impl true
  def handle_call(:create, _from, state) do
    secret = Secrets.new_secret()

    profile = %Profile{
      id: new_id(),
      name: Name.generate(state.names),
      secret_hashes: [Secrets.hash(secret)],
      created_at: DateTime.utc_now()
    }

    state = %{state | names: MapSet.put(state.names, profile.name)}
    profiles = Map.put(state.profiles, profile.id, profile)
    state = %{state | profiles: profiles}

    {:reply, {:ok, profile, secret}, state}
  end

  def handle_call({:get, id}, _from, state) do
    {:reply, Map.fetch(state.profiles, id), state}
  end

  def handle_call({:authenticate, id, secret}, _from, state) do
    reply =
      case Map.fetch(state.profiles, id) do
        {:ok, %Profile{secret_hashes: hashes}} ->
          Enum.any?(hashes, &Secrets.verify(secret, &1))

        :error ->
          false
      end

    {:reply, reply, state}
  end

  def handle_call({:link_account, id, account}, _from, state) do
    case Map.fetch(state.profiles, id) do
      {:ok, profile} ->
        accounts =
          [account | Enum.reject(profile.accounts, &(&1.type == account.type))]

        profiles = Map.put(state.profiles, id, %{profile | accounts: accounts})
        {:reply, {:ok, Map.fetch!(profiles, id)}, %{state | profiles: profiles}}

      :error ->
        {:reply, {:error, :not_found}, state}
    end
  end

  def handle_call({:profile_by_account, type, username}, _from, state) do
    found =
      Enum.find_value(state.profiles, fn {_id, profile} ->
        Enum.find_value(profile.accounts, fn account ->
          if account.type == type and account.username == username,
            do: profile,
            else: nil
        end)
      end)

    case found do
      nil -> {:reply, {:error, :not_found}, state}
      profile -> {:reply, {:ok, profile}, state}
    end
  end

  def handle_call({:issue_secret, id}, _from, state) do
    case Map.fetch(state.profiles, id) do
      {:ok, profile} ->
        secret = Secrets.new_secret()
        profile = %{profile | secret_hashes: [Secrets.hash(secret) | profile.secret_hashes]}
        {:reply, {:ok, profile, secret}, put_in(state.profiles[id], profile)}

      :error ->
        {:reply, {:error, :not_found}, state}
    end
  end

  def handle_call(:reset, _from, _state) do
    {:reply, :ok, %{profiles: %{}, names: MapSet.new()}}
  end

  defp new_id do
    :crypto.strong_rand_bytes(16)
    |> Base.url_encode64(padding: false)
  end
end
