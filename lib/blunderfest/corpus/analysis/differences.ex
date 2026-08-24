defmodule Blunderfest.Corpus.Analysis.Differences do
  @moduledoc """
  Typed position differences (port of Spike 04, experiment C): the useful
  candidates differ from their reference by **exactly one typed
  difference** — and the difference, not the similarity, is what makes the
  candidate interesting.

  Positional difference types:

    * `:tempo_twin` — identical piece placement, other side to move
      ("the same position, one tempo later/earlier").
    * `:near_twin` — same skeleton and material, other side to move, with
      exactly one piece relocated: either an *unspent tempo* (A2's Re1
      played vs not) or an *alternative setup with a tempo flip* (F1-B4's
      Nf3→d2). The square detail says which story it is.
    * `:piece_setup` — same skeleton, same side to move, same material,
      exactly one piece relocated (an alternative setup, e.g. Nf3→d2).
    * `:king_position` — kings on different squares with different castling
      rights.
    * `:material` — material distance 1..2 (same structure, different
      material).
    * `:structure` — pawn skeleton differs.

  Continuation-based types (need both games' following moves):

    * `:same_plan` — continuations share most of their content
      (multiset Jaccard ≥ 0.5).
    * `:timing_shift` — same moves, different order: multiset Jaccard
      ≥ 0.5 while sequence (LCS) similarity < 0.75.
    * `:plan_divergence` — position highly similar (same skeleton, at most
      one piece relocated) but continuations share almost nothing
      (multiset Jaccard < 0.2).

  Every diff entry is `%{type, detail}` with a human-readable `detail`
  line — the point is to *expose* the difference, not to score it.

  `dimensions/2` is the design brief §8 comparison report: the same facts
  as structured values, one entry per independently-observable dimension.
  """

  import Bitwise, only: [&&&: 2, <<<: 2]

  alias Blunderfest.Corpus.Analysis.{Continuation, Features}

  @same_plan_jaccard 0.5
  @timing_lcs 0.75
  @divergence_jaccard 0.2

  @piece_names ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"]

  @doc """
  Positional typed differences between reference and candidate features.
  Returns a list of `%{type, detail}`; an empty list means the positions
  are identical (including side to move).
  """
  @spec positional(Features.t(), Features.t()) :: [map()]
  def positional(ref, cand) do
    overlap = Features.piece_overlap(ref, cand)
    pawn_mm = Features.pawn_mismatches(ref, cand)
    king_d = Features.king_distance(ref, cand)
    material_d = Features.material_distance(ref, cand)

    []
    |> then(fn diffs ->
      cond do
        placement(ref) == placement(cand) and ref.stm != cand.stm ->
          [
            %{
              type: :tempo_twin,
              detail: "identical placement; #{side(cand.stm)} to move (tempo twin)"
            }
            | diffs
          ]

        pawn_mm == 0 and ref.stm != cand.stm and overlap.mismatches == 2 and king_d == 0 and
            material_d == 0 ->
          [
            %{
              type: :near_twin,
              detail:
                "one piece relocated (#{relocations_text(ref, cand)}), #{side(cand.stm)} " <>
                  "to move — unspent tempo or alternative setup"
            }
            | diffs
          ]

        pawn_mm == 0 and ref.stm == cand.stm and overlap.mismatches == 2 and material_d == 0 ->
          [
            %{
              type: :piece_setup,
              detail: "alternative setup: #{relocations_text(ref, cand)}"
            }
            | diffs
          ]

        true ->
          diffs
      end
    end)
    |> then(fn diffs ->
      if king_d > 0 and ref.castling != cand.castling do
        [
          %{
            type: :king_position,
            detail:
              "king placement differs (#{king_text(ref, cand)}); castling #{ref.castling} vs #{cand.castling}"
          }
          | diffs
        ]
      else
        diffs
      end
    end)
    |> then(fn diffs ->
      if material_d in 1..2 do
        [
          %{
            type: :material,
            detail: "material differs (#{Features.material_diff_description(ref, cand)})"
          }
          | diffs
        ]
      else
        diffs
      end
    end)
    |> then(fn diffs ->
      if pawn_mm > 0 do
        [
          %{type: :structure, detail: "different pawn skeleton (#{pawn_mm} pawn mismatches)"}
          | diffs
        ]
      else
        diffs
      end
    end)
    |> Enum.reverse()
  end

  @doc """
  The design brief §8 comparison report: each independently-observable
  dimension as a structured value.

      %{
        pawn_structure: :same | {:different, mismatches},
        material: :same | {:different, description},
        piece_placement: %{matches, mismatches, ref_pieces},
        king_position: :same | {:different, distance},
        side_to_move: :same | :differs,
        castling: :same | {:differs, ref_castling, cand_castling}
      }
  """
  @spec dimensions(Features.t(), Features.t()) :: map()
  def dimensions(ref, cand) do
    pawn_mm = Features.pawn_mismatches(ref, cand)
    king_d = Features.king_distance(ref, cand)
    material_d = Features.material_distance(ref, cand)

    %{
      pawn_structure: if(pawn_mm == 0, do: :same, else: {:different, pawn_mm}),
      material:
        if(material_d == 0,
          do: :same,
          else: {:different, Features.material_diff_description(ref, cand)}
        ),
      piece_placement: Features.piece_overlap(ref, cand),
      king_position: if(king_d == 0, do: :same, else: {:different, king_d}),
      side_to_move: if(ref.stm == cand.stm, do: :same, else: :differs),
      castling:
        if(ref.castling == cand.castling,
          do: :same,
          else: {:differs, ref.castling, cand.castling}
        )
    }
  end

  @doc """
  Continuation typed differences, given the two games' following-move
  windows (normalized SAN lists) and the positional similarity context
  (`pawn_mm` / `piece_mismatches` from the positional dims — plan
  divergence is only flagged for highly similar positions).
  """
  @spec continuation(Features.t(), Features.t(), [String.t()], [String.t()]) :: [map()]
  def continuation(ref, cand, ref_window, cand_window) do
    ms = Continuation.jaccard(Enum.sort(ref_window), Enum.sort(cand_window))
    lcs = Continuation.lcs_similarity(ref_window, cand_window)
    pawn_mm = Features.pawn_mismatches(ref, cand)
    overlap = Features.piece_overlap(ref, cand)

    []
    |> then(fn diffs ->
      if ms >= @same_plan_jaccard and ref_window != [] and cand_window != [] do
        [
          %{type: :same_plan, detail: "continuations share content (multiset Jaccard #{r2(ms)})"}
          | diffs
        ]
      else
        diffs
      end
    end)
    |> then(fn diffs ->
      if ms >= @same_plan_jaccard and lcs < @timing_lcs do
        [
          %{
            type: :timing_shift,
            detail: "same moves, different order (multiset #{r2(ms)}, sequence #{r2(lcs)})"
          }
          | diffs
        ]
      else
        diffs
      end
    end)
    |> then(fn diffs ->
      if pawn_mm == 0 and overlap.mismatches <= 2 and ms < @divergence_jaccard and
           ref_window != [] and cand_window != [] do
        [
          %{
            type: :plan_divergence,
            detail: "near-identical position, disjoint continuations (multiset Jaccard #{r2(ms)})"
          }
          | diffs
        ]
      else
        diffs
      end
    end)
    |> Enum.reverse()
  end

  @doc """
  Square-level piece relocations between two feature sets:
  `[{"wN", "f3", "d2"}]` means the white knight moved from f3 to d2.
  Only reported for (color, type) boards whose symmetric difference is
  exactly one vacated and one newly occupied square; larger diffs are
  summarized as `{"wN", "f3+e2", "d2"}`-style square sets.
  """
  @spec relocations(Features.t(), Features.t()) :: [{String.t(), String.t(), String.t()}]
  def relocations(ref, cand) do
    ref.boards
    |> Tuple.to_list()
    |> Enum.zip(Tuple.to_list(cand.boards))
    |> Enum.with_index()
    |> Enum.flat_map(fn {{r, c}, i} ->
      from = squares(r &&& bnot(c))
      to = squares(c &&& bnot(r))

      if from != [] or to != [] do
        [{Enum.at(@piece_names, i), Enum.join(from, "+"), Enum.join(to, "+")}]
      else
        []
      end
    end)
  end

  ## Helpers

  defp placement(f), do: f.key |> String.split(" ") |> hd()

  defp side(:w), do: "white"
  defp side(:b), do: "black"

  defp relocations_text(ref, cand) do
    case relocations(ref, cand) do
      [] -> "no square-level relocation found"
      rels -> rels |> Enum.map(fn {p, from, to} -> "#{p} #{from}→#{to}" end) |> Enum.join(", ")
    end
  end

  defp king_text(ref, cand) do
    wk = sq_name(Features.lsb(elem(ref.boards, 5)))
    wk_c = sq_name(Features.lsb(elem(cand.boards, 5)))
    bk = sq_name(Features.lsb(elem(ref.boards, 11)))
    bk_c = sq_name(Features.lsb(elem(cand.boards, 11)))

    [
      if(wk != wk_c, do: "wK #{wk}→#{wk_c}", else: nil),
      if(bk != bk_c, do: "bK #{bk}→#{bk_c}", else: nil)
    ]
    |> Enum.reject(&is_nil/1)
    |> Enum.join(", ")
  end

  @doc "Algebraic square name of a bit index (a8=0 .. h1=63)."
  @spec sq_name(non_neg_integer() | nil) :: String.t()
  def sq_name(nil), do: "??"

  def sq_name(sq) do
    <<?a + rem(sq, 8)>> <> Integer.to_string(8 - div(sq, 8))
  end

  defp squares(board) do
    for i <- 0..63, (board &&& 1 <<< i) != 0, do: sq_name(i)
  end

  defp bnot(x), do: :erlang.bnot(x)

  defp r2(x), do: Float.round(x, 2)
end
