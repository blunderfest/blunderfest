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

  def reset(server \\ __MODULE__) do
    GenServer.call(server, :reset)
  end

  @impl true
  def handle_call(:create, _from, state) do
    secret = Secrets.new_secret()

    profile = %Profile{
      id: new_id(),
      name: Name.generate(state.names),
      secret_hash: Secrets.hash(secret),
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
        {:ok, %Profile{secret_hash: stored}} -> Secrets.verify(secret, stored)
        :error -> false
      end

    {:reply, reply, state}
  end

  def handle_call(:reset, _from, _state) do
    {:reply, :ok, %{profiles: %{}, names: MapSet.new()}}
  end

  defp new_id do
    :crypto.strong_rand_bytes(16)
    |> Base.url_encode64(padding: false)
  end
end
