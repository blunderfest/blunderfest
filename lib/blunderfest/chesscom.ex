defmodule Blunderfest.Chesscom do
  @moduledoc """
  Chess.com imports — strictly via their official public API
  (`api.chess.com/pub/...`). Per Chess.com's robots.txt (`Disallow:
  /callback/`, `/service/`, `/download/pgn`, `/game/`) and User Agreement
  (no automated retrieval outside the sanctioned channel), no
  callback/service endpoints or page scraping are used here. Game records
  (UGA) are consumed under the license their terms grant for them.
  """

  @doc """
  A player's games for one month, compact: `%{id, white, black, result,
  date, speed, pgn}`. The public archive includes full PGNs inline, so no
  per-game fetches are needed downstream.
  """
  @spec games_for_month(binary(), pos_integer(), 1..12) ::
          {:ok, [map()]} | {:error, :not_found | :fetch_failed}
  def games_for_month(username, year, month) do
    # The pubapi requires the zero-padded month (/games/2026/07, not /7).
    path =
      "/player/#{URI.encode(username, &URI.char_unreserved?/1)}/games/#{year}/#{String.pad_leading(to_string(month), 2, "0")}"

    case Req.get(req_options(path)) do
      {:ok, %Req.Response{status: 200, body: %{"games" => games}}} when is_list(games) ->
        {:ok,
         games
         |> Enum.map(&game_summary/1)
         |> Enum.reject(&is_nil/1)}

      {:ok, %Req.Response{status: 404}} ->
        {:error, :not_found}

      {:ok, %Req.Response{}} ->
        {:error, :fetch_failed}

      {:error, _} ->
        {:error, :fetch_failed}
    end
  rescue
    _ -> {:error, :fetch_failed}
  end

  defp game_summary(%{"url" => url, "pgn" => pgn} = game) do
    with %{"username" => white} <- game["white"] || %{},
         %{"username" => black} <- game["black"] || %{} do
      %{
        id: url |> String.split("/") |> List.last(),
        white: white,
        black: black,
        result: game_result(game),
        date: game["end_time"],
        speed: game["time_class"],
        pgn: pgn
      }
    else
      _ -> nil
    end
  end

  defp game_summary(_), do: nil

  @draw_codes ~w(agreed repetition stalemate insufficient 50move timevsinsufficient)

  defp game_result(%{"white" => %{"result" => "win"}}), do: "1-0"
  defp game_result(%{"black" => %{"result" => "win"}}), do: "0-1"

  defp game_result(%{"white" => %{"result" => result}}) when result in @draw_codes,
    do: "1/2-1/2"

  defp game_result(%{"black" => %{"result" => result}}) when result in @draw_codes,
    do: "1/2-1/2"

  defp game_result(_), do: "*"

  defp req_options(path) do
    [
      url: path,
      base_url: "https://api.chess.com/pub",
      receive_timeout: 15_000,
      retry: false,
      headers: [user_agent: "blunderfest.org (game import for room owners)"]
    ]
    |> Keyword.merge(Application.get_env(:blunderfest, :chesscom_req_options, []))
  end
end
