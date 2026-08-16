defmodule BlunderfestWeb.AuthController do
  @moduledoc """
  The Lichess OAuth2+PKCE flow (ADR-0022): start (a JSON URL the SPA
  navigates to, keeping device secrets out of URLs), callback (token
  exchange + account fetch + link/recover), and the one-time exchange
  that hands a recovered identity to a new device.
  """

  use BlunderfestWeb, :controller

  alias Blunderfest.{Lichess, LichessAuth, Profiles}

  @doc """
  Starts the sign-in flow. One action: the callback binds the account to
  the current profile when it is new, or adopts the profile the account
  is already bound to (ADR-0022). Device credentials are required — the
  bearer identifies the current profile for the bind case; a JSON round
  trip means the secret never lands in a redirect URL.
  """
  def lichess_start(conn, _params) do
    case bearer_profile(conn) do
      {:ok, profile} ->
        {state, verifier} = LichessAuth.begin_flow(:sign_in, profile.id)
        challenge = Base.url_encode64(:crypto.hash(:sha256, verifier), padding: false)

        json(conn, %{url: Lichess.authorize_url(callback_url(conn), challenge, state)})

      :error ->
        unauthorized(conn)
    end
  end

  def lichess_callback(conn, %{"code" => code, "state" => state}) do
    with {:ok, flow} <- LichessAuth.pop_flow(state),
         {:ok, token} <- Lichess.exchange_token(code, callback_url(conn), flow.verifier),
         {:ok, username} <- Lichess.account_username(token) do
      account = %{
        type: "lichess",
        username: username,
        token: token,
        scopes: String.split(LichessAuth.oauth_scope(), " "),
        linked_at: DateTime.utc_now()
      }

      finish_callback(conn, flow, account)
    else
      _ -> redirect(conn, to: "/#/?auth_error=flow_failed")
    end
  end

  def lichess_callback(conn, _params) do
    redirect(conn, to: "/#/?auth_error=flow_failed")
  end

  @doc "Exchanges a single-use recovery code for fresh device credentials."
  def exchange(conn, %{"code" => code}) do
    with {:ok, profile_id} <- LichessAuth.pop_exchange_code(code),
         {:ok, profile, secret} <- Profiles.issue_secret(profile_id) do
      json(conn, %{profile: profile_json(profile), secret: secret})
    else
      _ ->
        conn
        |> put_status(:unauthorized)
        |> json(%{errors: %{code: "invalid_exchange_code"}})
    end
  end

  def exchange(conn, _params), do: invalid_request(conn)

  @doc """
  Detaches the lichess account from the device-authenticated profile and
  revokes the token at lichess (best-effort). Returns the updated profile.
  """
  def unlink(conn, _params) do
    case bearer_profile(conn) do
      {:ok, profile} ->
        account = Enum.find(profile.accounts, &(&1.type == "lichess"))
        if account != nil, do: Lichess.revoke_token(account.token)

        case Profiles.unlink_account(profile.id, "lichess") do
          {:ok, updated} ->
            json(conn, %{profile: profile_json(updated)})

          {:error, :not_found} ->
            conn
            |> put_status(:not_found)
            |> json(%{errors: %{code: "profile_not_found"}})
        end

      :error ->
        unauthorized(conn)
    end
  end

  ## Internals

  # The account is already bound: this session adopts the known profile —
  # the name follows the binding (use case: a second browser). The fresh
  # token replaces the stored one.
  defp finish_callback(conn, flow, account) do
    case Profiles.profile_by_account("lichess", account.username) do
      {:ok, known} ->
        {:ok, _} = Profiles.link_account(known.id, account)
        code = LichessAuth.issue_exchange_code(known.id)
        redirect(conn, to: "/#/?exchange=#{code}")

      {:error, :not_found} ->
        bind_to_current(conn, flow, account)
    end
  end

  # First sighting of the account: bind it to the current profile. The
  # current name stays.
  defp bind_to_current(conn, %{profile_id: profile_id}, account)
       when is_binary(profile_id) do
    case Profiles.link_account(profile_id, account) do
      {:ok, _} -> redirect(conn, to: "/#/?linked=lichess")
      {:error, :not_found} -> redirect(conn, to: "/#/?auth_error=profile_gone")
    end
  end

  defp bind_to_current(conn, _flow, _account) do
    redirect(conn, to: "/#/?auth_error=profile_gone")
  end

  defp bearer_profile(conn) do
    with ["Bearer " <> secret] <- get_req_header(conn, "authorization"),
         {:ok, id} <- Map.fetch(conn.params, "profile_id"),
         true <- Profiles.authenticate(id, secret),
         {:ok, profile} <- Profiles.get(id) do
      {:ok, profile}
    else
      _ -> :error
    end
  end

  defp callback_url(conn) do
    "#{conn.scheme}://#{conn.host}#{port_suffix(conn)}/auth/lichess/callback"
  end

  defp port_suffix(conn) do
    case conn.port do
      80 -> ""
      443 -> ""
      port -> ":#{port}"
    end
  end

  defp invalid_request(conn) do
    conn
    |> put_status(:bad_request)
    |> json(%{errors: %{code: "invalid_request"}})
  end

  defp unauthorized(conn) do
    conn
    |> put_status(:unauthorized)
    |> json(%{errors: %{code: "unauthorized"}})
  end

  defp profile_json(profile) do
    %{
      id: profile.id,
      name: profile.name,
      created_at: profile.created_at,
      accounts: Enum.map(profile.accounts, &account_json/1)
    }
  end

  # The token is a server-side credential and never leaves the server.
  defp account_json(account) do
    %{type: account.type, username: account.username, linked_at: account.linked_at}
  end
end
