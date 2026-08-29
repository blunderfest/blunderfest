defmodule Blunderfest.HistoricalEvidence do
  @moduledoc """
  The application-facing historical-evidence service (design brief §14):
  the stable API between the UI layer and the corpus boundary.

  `analyze/2` accepts a FEN, runs the `Blunderfest.Corpus.Search.Pipeline`,
  and returns a plain, serializable result — no corpus internals (no
  feature structs, no table shapes), no relevance score (brief §16), and
  no hard-coded interpretation: the client owns the presentation (brief
  §17).

  Options:

    * `:route` — the SAN list leading to the position (the user's game);
    * `:reference_moves` — the full mainline of the user's game, with
      `:ref_ply` naming the position's ply — enables the reference
      continuation window;
    * `:limit` / `:exact_limit` / `:bucket_limit` — candidate caps.
  """

  alias Blunderfest.Corpus.Analysis.{Counts, Skeleton}
  alias Blunderfest.Corpus.PositionKey
  alias Blunderfest.Corpus.Search.Pipeline

  @doc """
  A corpus game as a playable tree for the game-view feature (mainline
  only — the corpus drops clocks, comments and variations by design).
  """
  @spec game(pos_integer()) :: {:ok, map()} | {:error, :not_found | :unavailable}
  def game(gid) when is_integer(gid) and gid > 0 do
    case Blunderfest.Corpus.export_game(gid) do
      {:ok, tree} -> {:ok, Blunderfest.Game.Tree.to_map(tree)}
      {:error, :not_found} -> {:error, :not_found}
      _ -> {:error, :unavailable}
    end
  end

  @doc """
  Analyzes a FEN (or a bare canonical key, e.g. from tests). Returns
  `{:ok, result}` or `{:error, {:invalid_fen, reason}}`.
  """
  @spec analyze(String.t(), keyword()) :: {:ok, map()} | {:error, {:invalid_fen, String.t()}}
  def analyze(fen, opts \\ []) do
    with {:ok, key} <- to_key(fen) do
      pipeline_opts =
        Keyword.take(opts, [
          :route,
          :reference_moves,
          :ref_ply,
          :limit,
          :exact_limit,
          :bucket_limit,
          :scan_limit
        ])

      {:ok, key |> Pipeline.analyze(pipeline_opts) |> to_dto()}
    end
  end

  # A full FEN parses to a key; a bare canonical key passes through.
  defp to_key(input) do
    case PositionKey.from_fen(input) do
      {:ok, key} ->
        {:ok, key}

      {:error, _} ->
        if valid_key?(input), do: {:ok, input}, else: {:error, {:invalid_fen, input}}
    end
  end

  defp valid_key?(input) do
    case String.split(input, " ") do
      [placement, stm, _castling, _ep] ->
        stm in ["w", "b"] and
          String.match?(placement, ~r/^[1-8prnbqkPRNBQK\/]+$/) and
          String.length(placement) >= 8

      _ ->
        false
    end
  end

  defp to_dto(result) do
    stm = result.reference.stm

    %{
      reference: %{
        fen: result.reference.fen,
        occurrences: result.reference.historical.occurrences,
        games: result.reference.historical.games,
        families: Enum.map(result.reference.families, &family_dto(&1, stm)),
        next_moves: result.reference.next_moves
      },
      candidates: Enum.map(result.candidates, &candidate_dto/1),
      timings: result.timings
    }
  end

  # Members carry their per-side plan actions (the skeleton tokenization),
  # so the UI can show *what* a plan is — not just its id.
  defp family_dto(family, stm) do
    %{
      id: family.id,
      occurrences: family.occurrences,
      games: family.games,
      singleton: Counts.singleton?(family.games),
      members:
        Enum.map(family.members, fn m ->
          actions = Skeleton.represent(m.seq, :skeleton, stm)

          %{
            moves: m.seq,
            occurrences: m.count,
            white: Map.get(actions, :w, []),
            black: Map.get(actions, :b, [])
          }
        end)
    }
  end

  defp candidate_dto(cand) do
    %{
      id: cand.id,
      strategy: cand.strategy,
      stm: cand.stm,
      fen: cand.fen,
      gid: cand.gid,
      ply: cand.ply,
      game: game_dto(cand.game),
      position: %{
        dims: dims_dto(cand.position.dims),
        differences: Enum.map(cand.position.typed_differences, &diff_dto/1)
      },
      route: route_dto(cand.route),
      continuation: %{
        moves: cand.continuation.window,
        differences: Enum.map(cand.continuation.typed_differences, &diff_dto/1)
      },
      families: %{
        membership: membership_dto(cand.families.membership),
        skeleton: %{
          white: side_dto(cand.families.skeleton_white),
          black: side_dto(cand.families.skeleton_black)
        }
      },
      historical: cand.historical,
      flags: cand.flags
    }
  end

  defp game_dto(nil), do: nil

  defp game_dto(game) do
    Map.take(game, [
      :gid,
      :white,
      :black,
      :result,
      :date,
      :eco,
      :opening,
      :white_elo,
      :black_elo,
      :event,
      :time_control,
      :site
    ])
  end

  defp dims_dto(dims) do
    %{
      pawn_structure: json_safe(dims.pawn_structure),
      material: json_safe(dims.material),
      piece_placement: dims.piece_placement,
      king_position: json_safe(dims.king_position),
      side_to_move: dims.side_to_move,
      castling: json_safe(dims.castling)
    }
  end

  # Dimension values are `:same` atoms or `{:different, ...}` tuples;
  # tuples become lists for JSON (the client types read them as arrays).
  defp json_safe(v) when is_tuple(v), do: Tuple.to_list(v)
  defp json_safe(v), do: v

  defp diff_dto(diff), do: %{type: diff.type, detail: diff.detail}

  defp route_dto(route) do
    %{
      shared_plies: route.shared_plies,
      ref_ply: route.ref_ply,
      diverged_ply: route.diverged_ply,
      ref_move: route.ref_move,
      cand_move: route.cand_move,
      ply_gap: route.ply_gap,
      extra_white: route.extra.white,
      extra_black: route.extra.black,
      missing_white: route.missing.white,
      missing_black: route.missing.black
    }
  end

  defp membership_dto(membership) do
    %{
      status: membership.status,
      member_of: membership.member_of,
      sim: membership.sim,
      family_occurrences: Map.get(membership, :family_occurrences),
      family_games: Map.get(membership, :family_games)
    }
  end

  defp side_dto(side) do
    %{
      status: side.status,
      family_id: Map.get(side, :family_id),
      sim: Map.get(side, :sim),
      family_occurrences: Map.get(side, :family_occurrences),
      family_games: Map.get(side, :family_games)
    }
  end
end
