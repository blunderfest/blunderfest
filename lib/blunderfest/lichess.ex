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

  @spec export_pgn(binary()) :: {:ok, binary()} | {:error, :not_found | :fetch_failed}
  def export_pgn(game_id) do
    case Req.get(req_options("/game/export/#{game_id}")) do
      {:ok, %Req.Response{status: 200, body: body}} when is_binary(body) -> {:ok, body}
      {:ok, %Req.Response{status: 404}} -> {:error, :not_found}
      {:ok, %Req.Response{}} -> {:error, :fetch_failed}
      {:error, _} -> {:error, :fetch_failed}
    end
  rescue
    _ -> {:error, :fetch_failed}
  end

  defp req_options(url) do
    [
      url: url,
      base_url: "https://lichess.org",
      receive_timeout: 10_000,
      retry: false
    ]
    |> Keyword.merge(Application.get_env(:blunderfest, :lichess_req_options, []))
  end
end
