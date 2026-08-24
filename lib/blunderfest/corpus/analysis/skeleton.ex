defmodule Blunderfest.Corpus.Analysis.Skeleton do
  @moduledoc """
  Plan-skeleton tokenization and order-robust continuation representations
  (port of Spike 06; design brief §11).

  A **plan skeleton** abstracts a continuation window into per-color
  *actions* — one abstraction step above the raw per-color SAN multisets,
  one below the color-blind piece-type-only view:

      "Ne1"  → "N→e1"    (piece destination; disambiguation and captures dropped)
      "f5"   → "Pf→f5"   (the f-pawn reaches f5 — pawn moves keep their file)
      "fxe4" → "Pf→e4"   (the f-pawn captures on e4)
      "e8=Q" → "Pe→e8=Q" (promotions kept)
      "O-O"  → "O-O"     (castling is its own action)

  Two representations (the brief drops `:skeleton_phase`):

    * `:skeleton` — per-color multiset of actions, order-free.
      Similarity: mean per-color multiset Jaccard.
    * `:skeleton_seq` — per-color *sequences* of actions: order kept
      within each side, ignored across sides. The interleaving across
      colors is exactly what a tempo flip disturbs, so dropping it (and
      only it) is the minimal order-preservation that survives the flip.
      Similarity: mean per-color normalized LCS.

  `side_scores/3` exposes the per-color similarities separately — the
  tempo-twin lens from Spikes 04/05 ("black executes the plan, white
  reacts"), and `membership/5` applies it as the per-side family-joining
  layer on top of the *baseline* families (Spike 06 §3.3: per side,
  threshold 0.5). The skeleton never replaces the family clustering —
  it only annotates which side carries the family choice.
  """

  alias Blunderfest.Corpus.Analysis.Continuation

  @type action :: String.t()
  @type repr :: :skeleton | :skeleton_seq

  @representations [:skeleton, :skeleton_seq]

  @doc "All skeleton representation keys, in order of increasing temporal structure."
  @spec representations() :: [repr()]
  def representations, do: @representations

  @doc """
  The action token of a normalized SAN: piece→destination for pieces,
  pawn-file→destination for pawns (`Pf→f5`), castling as-is. Promotions
  keep their suffix. Unparseable tokens pass through with a `?→` prefix.
  """
  @spec action(Continuation.san()) :: action()
  def action(san) do
    case san do
      "O-O" ->
        "O-O"

      "O-O-O" ->
        "O-O-O"

      _ ->
        # Regex.run returns "" for non-participating middle groups and
        # omits non-participating trailing groups entirely.
        case Regex.run(~r/^([KQRBN])?([a-h])?[1-8]?x?([a-h][1-8])(=[QRBN])?$/, san) do
          [_, piece, file, dest | promotion] ->
            promo = Enum.join(promotion)

            cond do
              piece != "" -> piece <> "→" <> dest <> promo
              file != "" -> "P" <> file <> "→" <> dest <> promo
              true -> "P" <> String.first(dest) <> "→" <> dest <> promo
            end

          _ ->
            "?→" <> san
        end
    end
  end

  @doc """
  Computes a skeleton representation of a continuation window. `stm` is
  the side to move at the position; per-color attribution alternates from
  it, so a tempo-flipped candidate's moves still land in the right color
  bucket.
  """
  @spec represent([Continuation.san()], repr(), :w | :b) :: term()
  def represent(sans, :skeleton, stm) do
    sans
    |> Continuation.by_side(stm)
    |> Map.new(fn {color, list} -> {color, list |> Enum.map(&action/1) |> Enum.sort()} end)
  end

  def represent(sans, :skeleton_seq, stm) do
    sans
    |> Continuation.by_side(stm)
    |> Map.new(fn {color, list} -> {color, Enum.map(list, &action/1)} end)
  end

  @doc """
  A stable string key for a representation value (variation-level identity).
  """
  @spec repr_key(term(), repr()) :: String.t()
  def repr_key(value, :skeleton),
    do: "w: " <> Enum.join(value.w, " ") <> " | b: " <> Enum.join(value.b, " ")

  def repr_key(value, :skeleton_seq),
    do: "w: " <> Enum.join(value.w, " ") <> " | b: " <> Enum.join(value.b, " ")

  @doc """
  Similarity in `0.0..1.0` between two skeleton representation values:
  mean per-color multiset Jaccard (`:skeleton`), mean per-color LCS
  (`:skeleton_seq`). Colors empty on both sides carry no information and
  are skipped.
  """
  @spec similarity(term(), term(), repr()) :: float()
  def similarity(a, b, repr), do: side_scores(a, b, repr).mean

  @doc """
  Per-color similarity scores between two representation values:
  `%{w:, b:, mean:}`. The `mean` matches `similarity/3`.
  """
  @spec side_scores(term(), term(), repr()) :: %{w: float(), b: float(), mean: float()}
  def side_scores(a, b, repr) when repr in [:skeleton, :skeleton_seq] do
    sw = color_sim(Map.get(a, :w, []), Map.get(b, :w, []), repr)
    sb = color_sim(Map.get(a, :b, []), Map.get(b, :b, []), repr)

    sims = for s <- [sw, sb], not is_nil(s), do: s
    mean = if sims == [], do: 1.0, else: Enum.sum(sims) / length(sims)

    %{w: sw || 1.0, b: sb || 1.0, mean: mean}
  end

  defp color_sim([], [], _repr), do: nil
  defp color_sim(a, b, :skeleton), do: Continuation.jaccard(a, b)
  defp color_sim(a, b, :skeleton_seq), do: Continuation.lcs_similarity(a, b)

  @doc """
  The Spike 06 §3.3 per-side membership layer: scores a candidate window
  against each family of a **baseline** menu, per color, and reports
  whether the side joins (best family score ≥ threshold, default 0.5).

  `ref_stm` is the menu position's side to move, `cand_stm` the
  candidate's — the tempo flip stays correctly attributed per color.
  Returns `%{white: side_result, black: side_result}` where a side result
  is `%{status: :member | :none, family_id, sim, family_occurrences,
  family_games}` — `family_id`/`sim` of the nearest family even when not
  joining, so "no family" stays visible.
  """
  @spec membership([map()], [Continuation.san()], :w | :b, :w | :b, float()) :: map()
  def membership(menu, cand_window, cand_stm, ref_stm, threshold \\ 0.5) do
    cand = represent(cand_window, :skeleton, cand_stm)

    for side <- [:white, :black] do
      color = if side == :white, do: :w, else: :b
      cand_side = Map.get(cand, color, [])

      scored =
        menu
        |> Enum.map(fn family ->
          best =
            family.members
            |> Enum.map(fn m ->
              member = represent(m.seq, :skeleton, ref_stm)

              if cand_side == [] and Map.get(member, color, []) == [] do
                nil
              else
                color_sim(cand_side, Map.get(member, color, []), :skeleton)
              end
            end)
            |> Enum.reject(&is_nil/1)
            |> Enum.max(fn -> 0.0 end)

          %{
            family_id: family.id,
            sim: Float.round(best, 3),
            family_occurrences: family.occurrences,
            family_games: family.games
          }
        end)
        |> Enum.sort_by(fn s -> {-s.sim, -s.family_occurrences, s.family_id} end)

      {side,
       case scored do
         [] ->
           %{status: :no_menu, family_id: nil, sim: nil}

         [best | _] ->
           %{
             status: if(best.sim >= threshold, do: :member, else: :none),
             family_id: best.family_id,
             sim: best.sim,
             family_occurrences: best.family_occurrences,
             family_games: best.family_games
           }
       end}
    end
    |> Map.new()
  end
end
