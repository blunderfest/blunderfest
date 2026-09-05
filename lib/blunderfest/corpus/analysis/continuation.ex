defmodule Blunderfest.Corpus.Analysis.Continuation do
  @moduledoc """
  Following-move ("continuation") representations and similarity (port of
  Spike 04).

  A continuation is the list of SANs played *after* a position, taken from
  the game's mainline. All SANs are normalized first: check/mate and
  annotation suffixes (`+ # ? !`) are stripped so that e.g. `exd4?!` and
  `exd4` compare equal.

  Five representations, from most literal to most abstract:

    * `:seq` — the normalized sequence itself. Exact-order comparison.
    * `:multiset` — the same moves as an unordered multiset. Merges true
      move-order transpositions.
    * `:side_multiset` — per-color multisets (`%{w: [...], b: [...]}`),
      aligned by color. This is the representation that survives a tempo
      flip: when the candidate has the other side to move, each side's
      moves still land in the same color bucket.
    * `:piece_dest` — multiset of piece→destination tokens (`"N→e1"`,
      `"P→f5"`, `"O-O"`): which piece went where, ignoring captures,
      disambiguation and exact phrasing.
    * `:piece` — multiset of moving piece types only (`["N", "N", "B", "P"]`):
      the coarsest "what kind of moves were played" abstraction.

  Similarity is measured by:

    * `jaccard/2` — multiset Jaccard (multiplicity-aware) for the multiset
      representations;
    * `lcs_similarity/2` — longest-common-subsequence length, normalized to
      `2·|LCS|/(|a|+|b|)`, for sequences (tolerates insertions/deletions
      and timing shifts while respecting order);
    * `side_jaccard/2` — mean of the per-color multiset Jaccards.

  Nothing here decides what a continuation *means* — these are observable
  sequence facts only.
  """

  @type san :: String.t()
  @type repr :: :seq | :multiset | :side_multiset | :piece_dest | :piece

  @representations [:seq, :multiset, :side_multiset, :piece_dest, :piece]

  @doc "All representation keys, in order of increasing abstraction."
  @spec representations() :: [repr()]
  def representations, do: @representations

  @doc """
  Strips check/mate (`+`, `#`) and annotation (`?`, `!`) suffixes from a
  SAN token. Also normalizes the long castle spelling `O-O-O`.
  """
  @spec normalize(san) :: san
  def normalize(san) when is_binary(san) do
    String.replace(san, ~r/[+#?!]+$/, "")
  end

  @doc """
  The `n` half-moves following ply `ply` of a game, normalized. The
  position at ply `p` is the one *after* the p-th move, so the continuation
  starts at index `p` of the move list. Clipped at the end of the game.
  """
  @spec window([san], non_neg_integer(), non_neg_integer()) :: [san]
  def window(sans, ply, n) do
    sans
    |> Enum.drop(ply)
    |> Enum.take(n)
    |> Enum.map(&normalize/1)
  end

  @doc """
  Splits a window into per-color move lists. `stm` (`:w` or `:b`) is the
  side to move at the position — they play the window's first move, and
  colors alternate from there.
  """
  @spec by_side([san], :w | :b) :: %{w: [san], b: [san]}
  def by_side(sans, stm) do
    sans
    |> Enum.with_index()
    |> Enum.reduce(%{w: [], b: []}, fn {san, i}, acc ->
      mover = if rem(i, 2) == 0, do: stm, else: opposite(stm)
      Map.update!(acc, mover, &[san | &1])
    end)
    |> Map.new(fn {color, list} -> {color, Enum.reverse(list)} end)
  end

  defp opposite(:w), do: :b
  defp opposite(:b), do: :w

  @doc """
  Computes a representation of a continuation window. `:side_multiset`
  needs the side to move at the position (`stm`); the other
  representations ignore it.
  """
  @spec represent([san], repr(), :w | :b) :: term()
  def represent(sans, :seq, _stm), do: sans
  def represent(sans, :multiset, _stm), do: Enum.sort(sans)

  def represent(sans, :side_multiset, stm) do
    sans
    |> by_side(stm)
    |> Map.new(fn {color, list} -> {color, Enum.sort(list)} end)
  end

  def represent(sans, :piece_dest, _stm), do: sans |> Enum.map(&piece_dest/1) |> Enum.sort()
  def represent(sans, :piece, _stm), do: sans |> Enum.map(&moving_piece/1) |> Enum.sort()

  @doc """
  A stable string key for a representation value (grouping key for exact
  clustering).
  """
  @spec repr_key(term(), repr()) :: String.t()
  def repr_key(value, :seq), do: Enum.join(value, " ")
  def repr_key(value, :multiset), do: Enum.join(value, " ")

  def repr_key(value, :side_multiset),
    do: "w: " <> Enum.join(value.w, " ") <> " | b: " <> Enum.join(value.b, " ")

  def repr_key(value, _repr), do: Enum.join(value, " ")

  @doc """
  Similarity in `0.0..1.0` between two continuation windows under a
  representation. `:seq` uses normalized LCS; the multiset representations
  use multiset Jaccard; `:side_multiset` averages per color.
  """
  @spec similarity([san] | term(), [san] | term(), repr()) :: float()
  def similarity(a, b, :seq) when is_list(a), do: lcs_similarity(a, b)
  def similarity(a, b, :multiset), do: jaccard(a, b)
  def similarity(a, b, :piece_dest), do: jaccard(a, b)
  def similarity(a, b, :piece), do: jaccard(a, b)

  def similarity(a, b, :side_multiset), do: side_jaccard(a, b)

  @doc """
  Multiplicity-aware Jaccard index of two multisets (plain lists):
  `Σ min / Σ max` over the union of elements. Both empty → 1.0.
  """
  @spec jaccard(list(), list()) :: float()
  def jaccard(a, b) when is_list(a) and is_list(b) do
    jaccard_freq(Enum.frequencies(a), Enum.frequencies(b))
  end

  @doc """
  Jaccard index from precomputed frequency maps (`Enum.frequencies/1` of
  each multiset). Exactly `jaccard/2` with the frequencies hoisted out, so
  a hot comparison set (the family clustering's O(n²) pairs) computes each
  multiset's frequencies once instead of once per pair. Both empty → 1.0.
  """
  @spec jaccard_freq(map(), map()) :: float()
  def jaccard_freq(fa, fb) when is_map(fa) and is_map(fb) do
    {inter, union} =
      Enum.reduce(fa, {0, 0}, fn {k, x}, {i, u} ->
        y = Map.get(fb, k, 0)
        {i + min(x, y), u + max(x, y)}
      end)

    union =
      Enum.reduce(fb, union, fn {k, y}, u ->
        if Map.has_key?(fa, k), do: u, else: u + y
      end)

    if union == 0, do: 1.0, else: inter / union
  end

  @doc """
  Mean of the per-color multiset Jaccards of two `%{w: [...], b: [...]}`
  side maps. A color present in neither window is skipped (no information).
  """
  @spec side_jaccard(%{w: [san], b: [san]}, %{w: [san], b: [san]}) :: float()
  def side_jaccard(a, b) do
    sims =
      for color <- [:w, :b], Map.get(a, color, []) != [] or Map.get(b, color, []) != [] do
        jaccard(Map.get(a, color, []), Map.get(b, color, []))
      end

    case sims do
      [] -> 1.0
      _ -> Enum.sum(sims) / length(sims)
    end
  end

  @doc """
  Longest-common-subsequence similarity of two sequences:
  `2·|LCS| / (|a| + |b|)`. Both empty → 1.0; one empty → 0.0.
  """
  @spec lcs_similarity(list(), list()) :: float()
  def lcs_similarity(a, b) when is_list(a) and is_list(b) do
    case {length(a), length(b)} do
      {0, 0} -> 1.0
      {0, _} -> 0.0
      {_, 0} -> 0.0
      {n, m} -> 2 * lcs_length(a, b) / (n + m)
    end
  end

  @doc "Length of the longest common subsequence of two lists."
  @spec lcs_length(list(), list()) :: non_neg_integer()
  def lcs_length(a, b) do
    ta = List.to_tuple(a)
    tb = List.to_tuple(b)
    n = tuple_size(ta)
    m = tuple_size(tb)

    # dp[{i, j}] = LCS length of a[i..] and b[j..], built bottom-up.
    dp =
      for i <- (n - 1)..0//-1, j <- (m - 1)..0//-1, reduce: %{} do
        acc ->
          value =
            if elem(ta, i) == elem(tb, j) do
              1 + Map.get(acc, {i + 1, j + 1}, 0)
            else
              max(Map.get(acc, {i + 1, j}, 0), Map.get(acc, {i, j + 1}, 0))
            end

          Map.put(acc, {i, j}, value)
      end

    Map.get(dp, {0, 0}, 0)
  end

  @doc """
  Piece→destination abstraction of a normalized SAN token:

    * `"Ne8"` → `"N→e8"`, `"Nbd7"` → `"N→d7"` (disambiguation dropped)
    * `"f5"` / `"fxe4"` → `"P→f5"` / `"P→e4"` (captures look identical)
    * `"e8=Q"` → `"P→e8=Q"` (promotion kept)
    * `"O-O"` / `"O-O-O"` kept as-is (castling is its own action)
  """
  @spec piece_dest(san) :: String.t()
  def piece_dest(san) do
    case san do
      "O-O" ->
        "O-O"

      "O-O-O" ->
        "O-O-O"

      _ ->
        # Regex.run returns "" for non-participating middle groups and omits
        # non-participating trailing groups entirely.
        case Regex.run(~r/^([KQRBN])?[a-h]?[1-8]?x?([a-h][1-8])(=[QRBN])?$/, san) do
          [_, piece, dest | promotion] ->
            p = if piece == "", do: "P", else: piece
            p <> "→" <> dest <> Enum.join(promotion)

          _ ->
            # Unparseable SAN (should not happen on a normalized mainline) —
            # keep the raw token rather than crash the pipeline.
            "?→" <> san
        end
    end
  end

  @doc "The moving piece type of a normalized SAN token (`\"P\"` for pawn moves and castling is `\"K\"`)."
  @spec moving_piece(san) :: String.t()
  def moving_piece(san) do
    case san do
      "O-O" -> "K"
      "O-O-O" -> "K"
      <<c::utf8, _::binary>> when c in ~c(KQRBN) -> <<c::utf8>>
      _ -> "P"
    end
  end
end
