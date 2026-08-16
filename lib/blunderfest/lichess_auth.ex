defmodule Blunderfest.LichessAuth do
  @moduledoc """
  Short-lived state for the Lichess OAuth2+PKCE flow (ADR-0022): the
  pre-callback `state` param with its PKCE verifier and intent, and the
  single-use exchange codes that hand a recovered profile to a new device.
  Everything expires within minutes — in-memory is the right home.
  """

  use GenServer

  @state_ttl_ms 10 * 60 * 1000
  @exchange_ttl_ms 5 * 60 * 1000
  @sweep_ms 60 * 1000

  @scope "study:read game:read"

  def start_link(opts) do
    GenServer.start_link(__MODULE__, nil, name: Keyword.get(opts, :name, __MODULE__))
  end

  @doc "The OAuth scope we request: identity plus study/game imports (ADR-0022)."
  def oauth_scope, do: @scope

  @doc """
  Starts a flow: returns `{state_param, pkce_verifier}` to embed in the
  authorize URL and the token exchange respectively. `intent` is
  `:link` (attach to the current profile) or `:recover` (sign in anew).
  """
  def begin_flow(intent, profile_id \\ nil, server \\ __MODULE__)
      when intent in [:link, :recover] do
    GenServer.call(server, {:begin_flow, intent, profile_id})
  end

  @doc "Pops a flow's intent and verifier (single use). :error when unknown/expired."
  def pop_flow(state_param, server \\ __MODULE__) do
    GenServer.call(server, {:pop_flow, state_param})
  end

  @doc "Mints a single-use exchange code for a recovered profile."
  def issue_exchange_code(profile_id, server \\ __MODULE__) do
    GenServer.call(server, {:issue_exchange_code, profile_id})
  end

  @doc "Pops the profile id behind an exchange code (single use). :error when unknown/expired."
  def pop_exchange_code(code, server \\ __MODULE__) do
    GenServer.call(server, {:pop_exchange_code, code})
  end

  def reset(server \\ __MODULE__), do: GenServer.call(server, :reset)

  @impl true
  def init(nil) do
    Process.send_after(self(), :sweep, @sweep_ms)
    {:ok, %{flows: %{}, exchanges: %{}}}
  end

  @impl true
  def handle_call({:begin_flow, intent, profile_id}, _from, state) do
    state_param = random_token()
    verifier = random_token()

    flow = %{
      intent: intent,
      profile_id: profile_id,
      verifier: verifier,
      expires_at: now_ms() + @state_ttl_ms
    }

    {:reply, {state_param, verifier}, put_in(state.flows[state_param], flow)}
  end

  def handle_call({:pop_flow, state_param}, _from, state) do
    {flow, flows} = Map.pop(state.flows, state_param)
    now = now_ms()

    reply =
      case flow do
        %{expires_at: expires_at} = flow when is_number(expires_at) ->
          if expires_at >= now,
            do: {:ok, Map.take(flow, [:intent, :profile_id, :verifier])},
            else: :error

        _ ->
          :error
      end

    {:reply, reply, %{state | flows: flows}}
  end

  def handle_call({:issue_exchange_code, profile_id}, _from, state) do
    code = random_token()
    entry = %{profile_id: profile_id, expires_at: now_ms() + @exchange_ttl_ms}
    {:reply, code, put_in(state.exchanges[code], entry)}
  end

  def handle_call({:pop_exchange_code, code}, _from, state) do
    {entry, exchanges} = Map.pop(state.exchanges, code)
    now = now_ms()

    reply =
      case entry do
        %{expires_at: expires_at, profile_id: profile_id} when is_number(expires_at) ->
          if expires_at >= now, do: {:ok, profile_id}, else: :error

        _ ->
          :error
      end

    {:reply, reply, %{state | exchanges: exchanges}}
  end

  def handle_call(:reset, _from, _state) do
    {:reply, :ok, %{flows: %{}, exchanges: %{}}}
  end

  @impl true
  def handle_info(:sweep, state) do
    now = now_ms()
    flows = Map.filter(state.flows, fn {_key, flow} -> flow.expires_at >= now end)
    exchanges = Map.filter(state.exchanges, fn {_key, entry} -> entry.expires_at >= now end)
    Process.send_after(self(), :sweep, @sweep_ms)
    {:noreply, %{state | flows: flows, exchanges: exchanges}}
  end

  defp random_token do
    :crypto.strong_rand_bytes(32) |> Base.url_encode64(padding: false)
  end

  defp now_ms, do: System.monotonic_time(:millisecond)
end
