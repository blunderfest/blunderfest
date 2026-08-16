defmodule Blunderfest.Lichess do
  @moduledoc """
  Fetches game PGNs from Lichess.

  Uses the legacy `game/export` route: the newer `/api/games/export` endpoint
  can lag behind for freshly played games, while the legacy route serves all
  public games immediately and needs no authentication. Game URLs and bare
  game IDs are both accepted.
  """

  @game_id_re ~r/^(?:https?:\/\/)?(?:www\.)?lichess\.org\/([A-Za-z0-9]{6,12})(?:\/.*)?$/
  @bare_id_re ~r/^[A-Za-z0-9]{6,12}$/

  @spec game_id(binary()) :: {:ok, binary()} | {:error, :invalid_url}
  def game_id(url) when is_binary(url) do
    case Regex.run(@game_id_re, url) do
      [_, id] ->
        {:ok, id}

      nil ->
        if Regex.match?(@bare_id_re, url),
          do: {:ok, url},
          else: {:error, :invalid_url}
    end
  end

  def game_id(_), do: {:error, :invalid_url}

  @spec export_pgn(binary(), binary() | nil) ::
          {:ok, binary()} | {:error, :not_found | :fetch_failed}
  def export_pgn(game_id, token \\ nil) do
    auth = if token != nil, do: [auth: {:bearer, token}], else: []

    case Req.get(req_options("/game/export/#{game_id}", auth)) do
      {:ok, %Req.Response{status: 200, body: body}} when is_binary(body) -> {:ok, body}
      {:ok, %Req.Response{status: 404}} -> {:error, :not_found}
      {:ok, %Req.Response{}} -> {:error, :fetch_failed}
      {:error, _} -> {:error, :fetch_failed}
    end
  rescue
    _ -> {:error, :fetch_failed}
  end

  ## OAuth2+PKCE (ADR-0022)

  @authorize_url "https://lichess.org/oauth"
  @token_url "https://lichess.org/api/token"

  @doc """
  The OAuth client id. Lichess supports unregistered public clients — any
  unique id works, no app registration or secret; this is shown on the
  consent screen.
  """
  def client_id do
    Application.get_env(:blunderfest, :lichess_client_id, "blunderfest.org")
  end

  @doc """
  Builds the authorize URL for a flow: `redirect_uri` is our callback,
  `challenge` the PKCE S256 challenge, `state` the CSRF token, `scope`
  from `Blunderfest.LichessAuth.oauth_scope/0`.
  """
  @spec authorize_url(binary(), binary(), binary()) :: binary()
  def authorize_url(redirect_uri, challenge, state) do
    @authorize_url <>
      "?" <>
      URI.encode_query(
        response_type: "code",
        client_id: client_id(),
        redirect_uri: redirect_uri,
        code_challenge_method: "S256",
        code_challenge: challenge,
        state: state,
        scope: Blunderfest.LichessAuth.oauth_scope()
      )
  end

  @doc "Exchanges an authorization code + PKCE verifier for an access token."
  @spec exchange_token(binary(), binary(), binary()) ::
          {:ok, binary()} | {:error, :fetch_failed}
  def exchange_token(code, redirect_uri, verifier) do
    body = %{
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirect_uri,
      client_id: client_id(),
      code_verifier: verifier
    }

    case Req.post(req_options(@token_url), form: body) do
      {:ok, %Req.Response{status: 200, body: %{"access_token" => token}}} when is_binary(token) ->
        {:ok, token}

      _ ->
        {:error, :fetch_failed}
    end
  rescue
    _ -> {:error, :fetch_failed}
  end

  @doc "Fetches the authenticated account's username."
  @spec account_username(binary()) :: {:ok, binary()} | {:error, :fetch_failed}
  def account_username(token) do
    case Req.get(req_options("/api/account", auth: {:bearer, token})) do
      {:ok, %Req.Response{status: 200, body: %{"username" => username}}}
      when is_binary(username) ->
        {:ok, username}

      _ ->
        {:error, :fetch_failed}
    end
  rescue
    _ -> {:error, :fetch_failed}
  end

  @doc """
  Revokes an access token at lichess (`DELETE /api/token`). Best-effort
  hygiene when unlinking — the caller proceeds regardless of the outcome.
  """
  @spec revoke_token(binary()) :: :ok
  def revoke_token(token) do
    _ = Req.delete(req_options("/api/token", auth: {:bearer, token}))
    :ok
  rescue
    _ -> :ok
  end

  ## Studies (ADR-0022, `study:read` token)

  @doc """
  Lists the token owner's studies (public, unlisted and private with
  `study:read`) as `{id, name, created_at, updated_at}` maps. The endpoint
  streams ndjson — one metadata object per line.
  """
  @spec studies(binary(), binary()) :: {:ok, [map()]} | {:error, :fetch_failed}
  def studies(token, username) do
    case Req.get(req_options("/api/study/by/#{username}", auth: {:bearer, token})) do
      {:ok, %Req.Response{status: 200, body: body}} when is_binary(body) ->
        studies =
          body
          |> String.split("\n", trim: true)
          |> Enum.map(fn line ->
            case Jason.decode(line) do
              {:ok, %{"id" => id, "name" => name, "createdAt" => created, "updatedAt" => updated}} ->
                %{id: id, name: name, created_at: created, updated_at: updated}

              _ ->
                nil
            end
          end)
          |> Enum.reject(&is_nil/1)

        {:ok, studies}

      _ ->
        {:error, :fetch_failed}
    end
  rescue
    _ -> {:error, :fetch_failed}
  end

  @doc "Fetches a study's PGN (every chapter) with the owner's token."
  @spec study_pgn(binary(), binary()) ::
          {:ok, binary()} | {:error, :not_found | :fetch_failed}
  def study_pgn(token, study_id) do
    case Req.get(req_options("/api/study/#{study_id}.pgn", auth: {:bearer, token})) do
      {:ok, %Req.Response{status: 200, body: body}} when is_binary(body) -> {:ok, body}
      {:ok, %Req.Response{status: 404}} -> {:error, :not_found}
      {:ok, %Req.Response{}} -> {:error, :fetch_failed}
      {:error, _} -> {:error, :fetch_failed}
    end
  rescue
    _ -> {:error, :fetch_failed}
  end

  @doc """
  The token owner's recent games as compact maps
  `%{id, white, black, result, date, speed}` — the endpoint streams ndjson
  (per-user rate limits with the token).
  """
  @spec recent_games(binary(), binary(), pos_integer()) ::
          {:ok, [map()]} | {:error, :fetch_failed}
  def recent_games(token, username, max \\ 10) do
    options =
      req_options("/api/games/user/#{username}",
        auth: {:bearer, token},
        params: [max: max],
        headers: [accept: "application/x-ndjson"]
      )

    case Req.get(options) do
      {:ok, %Req.Response{status: 200, body: body}} when is_binary(body) ->
        games =
          body
          |> String.split("\n", trim: true)
          |> Enum.map(&parse_game_line/1)
          |> Enum.reject(&is_nil/1)

        {:ok, games}

      _ ->
        {:error, :fetch_failed}
    end
  rescue
    _ -> {:error, :fetch_failed}
  end

  defp parse_game_line(line) do
    case Jason.decode(line) do
      {:ok, %{"id" => id} = game} ->
        %{
          id: id,
          white: get_in(game, ["players", "white", "user", "name"]) || "?",
          black: get_in(game, ["players", "black", "user", "name"]) || "?",
          result: game_result(game),
          date: game["lastMoveAt"] || game["createdAt"],
          speed: game["speed"]
        }

      _ ->
        nil
    end
  end

  defp game_result(game) do
    case {game["status"], game["winner"]} do
      {_, "white"} -> "1-0"
      {_, "black"} -> "0-1"
      {"draw", _} -> "1/2-1/2"
      {"stalemate", _} -> "1/2-1/2"
      _ -> "*"
    end
  end

  defp req_options(url, extra \\ []) do
    [
      url: url,
      base_url: "https://lichess.org",
      receive_timeout: 10_000,
      retry: false
    ]
    |> Keyword.merge(Application.get_env(:blunderfest, :lichess_req_options, []))
    |> Keyword.merge(extra)
  end
end
