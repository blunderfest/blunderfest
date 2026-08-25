defmodule Blunderfest.Corpus.GameExport do
  @moduledoc """
  Reconstructs a playable game tree from the corpus rows.

  The corpus stores the game headers and the mainline SAN list (clocks,
  comments and variations are dropped by extraction, by design), so the
  export is a clean mainline game: fully navigable in the analysis view,
  engine analysis included. The Examples cards link out to it.
  """

  alias Blunderfest.Corpus.Occurrences

  @tags [
    {"Event", :event},
    {"Site", :site},
    {"Date", :date},
    {"White", :white},
    {"Black", :black},
    {"Result", :result},
    {"ECO", :eco},
    {"Opening", :opening},
    {"WhiteElo", :white_elo},
    {"BlackElo", :black_elo},
    {"TimeControl", :time_control}
  ]

  @spec tree(pos_integer(), pid()) ::
          {:ok, Blunderfest.Game.Tree.t()} | {:error, :not_found | :parse_failed}
  def tree(gid, conn) do
    case Occurrences.game(conn, gid) do
      nil ->
        {:error, :not_found}

      meta ->
        pgn =
          [
            headers(meta),
            "\n",
            number(Occurrences.moves(conn, gid)),
            result_token(meta.result),
            "\n"
          ]
          |> IO.iodata_to_binary()

        case Blunderfest.PGN.parse(pgn) do
          {:ok, tree} -> {:ok, tree}
          {:error, _} -> {:error, :parse_failed}
        end
    end
  end

  defp headers(meta) do
    for {tag, key} <- @tags, value = meta[key], not is_nil(value) do
      ["[", tag, " \"", to_string(value), "\"]\n"]
    end
  end

  # The corpus SAN list is unnumbered (as played); the parser expects PGN
  # movetext with move numbers.
  defp number(sans) do
    sans
    |> Enum.chunk_every(2)
    |> Enum.with_index(1)
    |> Enum.map_join(" ", fn
      {[white, black], n} -> "#{n}. #{white} #{black}"
      {[white], n} -> "#{n}. #{white}"
    end)
  end

  defp result_token(result) when result in ["1-0", "0-1", "1/2-1/2"], do: " " <> result
  defp result_token(_), do: ""
end
