defmodule Blunderfest.Corpus.Analysis.Features do
  @moduledoc """
  Position feature extraction (port of Spike 02): the independently-observable
  similarity dimensions of the historical-evidence pipeline, computed from a
  canonical position key.

  A canonical key (`"<placement> <stm> <castling> <ep>"`, see
  `Blunderfest.Corpus.PositionKey`) is parsed into per-(color, type)
  bitboards: 64-bit integers, bit `i` set iff square `i` holds the piece,
  squares numbered a8=0 .. h1=63 (the echecs board convention). All
  similarity dimensions are then pure bit arithmetic:

    * `pawn_hash/1` — BLAKE2b-128 (unsigned integer) of the pawn skeleton;
      bucket identity for pawn-structure strategies.
    * `pawn_mismatches/2` — symmetric-difference popcount of the two pawn
      sets (white-vs-white plus black-vs-black). 0 means same skeleton.
    * `material_distance/2` — L1 distance between material signatures
      `{wp,wn,wb,wr,wq, bp,bn,bb,br,bq}` (kings omitted: always 1-1 in legal
      positions). 0 = identical material; 2 = e.g. one side up a pawn while
      down a knight.
    * `material_diff_description/2` — human-readable material delta.
    * `piece_overlap/2` — non-pawn, non-king placement: per (color, type)
      square-set intersections (`matches`) and symmetric differences
      (`mismatches`). Kings are reported separately, not in this number.
    * `king_distance/2` — sum of per-color Chebyshev distances between king
      squares.
    * `developed/1` — minor pieces (N/B) not on their home squares
      {b1,c1,f1,g1} / {b8,c8,f8,g8}; the crudest possible development proxy.
    * `piece_count/1` — total pieces on the board (game-phase proxy).

  Nothing here decides "how good" a candidate is — every function exposes
  one dimension so a human can see *why* a candidate was retrieved.
  """

  import Bitwise, only: [&&&: 2, |||: 2, <<<: 2, >>>: 2]

  alias Blunderfest.Corpus.PositionKey

  @enforce_keys [:key, :stm, :castling, :ep]
  defstruct [
    :key,
    :stm,
    :castling,
    :ep,
    boards: {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
    material: {0, 0, 0, 0, 0, 0, 0, 0, 0, 0}
  ]

  @type color :: :w | :b

  @type bitboards ::
          {non_neg_integer(), non_neg_integer(), non_neg_integer(), non_neg_integer(),
           non_neg_integer(), non_neg_integer(), non_neg_integer(), non_neg_integer(),
           non_neg_integer(), non_neg_integer(), non_neg_integer(), non_neg_integer()}

  @type material_sig ::
          {0..16, 0..10, 0..10, 0..10, 0..10, 0..16, 0..10, 0..10, 0..10, 0..10}

  @type t :: %__MODULE__{
          key: String.t(),
          stm: color(),
          castling: String.t(),
          ep: String.t(),
          boards: bitboards(),
          material: material_sig()
        }

  # boards tuple order: wp wn wb wr wq wk | bp bn bb br bq bk
  @wp 0
  @wn 1
  @wb 2
  @wr 3
  @wq 4
  @wk 5
  @bp 6
  @bn 7
  @bb 8
  @br 9
  @bq 10
  @bk 11

  @piece_idxs [@wn, @wb, @wr, @wq, @bn, @bb, @br, @bq]

  @mask64 0xFFFFFFFFFFFFFFFF

  @doc "Parses a canonical key into features."
  @spec from_key(String.t()) :: t()
  def from_key(key) when is_binary(key) do
    [placement, stm, castling, ep] = String.split(key, " ")

    boards =
      placement
      |> String.split("/", trim: true)
      |> Enum.with_index()
      |> Enum.reduce({0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, fn {row, rank}, acc ->
        place_row(row, rank * 8, acc)
      end)

    material = {
      popcount(elem(boards, @wp)),
      popcount(elem(boards, @wn)),
      popcount(elem(boards, @wb)),
      popcount(elem(boards, @wr)),
      popcount(elem(boards, @wq)),
      popcount(elem(boards, @bp)),
      popcount(elem(boards, @bn)),
      popcount(elem(boards, @bb)),
      popcount(elem(boards, @br)),
      popcount(elem(boards, @bq))
    }

    %__MODULE__{
      key: key,
      stm: if(stm == "w", do: :w, else: :b),
      castling: castling,
      ep: ep,
      boards: boards,
      material: material
    }
  end

  @doc "Full FEN (zero counters appended) for display and board links."
  @spec fen(t() | String.t()) :: String.t()
  def fen(%__MODULE__{key: key}), do: key <> " 0 1"
  def fen(key) when is_binary(key), do: key <> " 0 1"

  @doc """
  Pawn-skeleton bucket hash: BLAKE2b-128 of the pawn skeleton, truncated to
  63 bits. The truncation is a storage reality — the corpus stores the hash
  in a signed `bigint` column, and a *bucket* index needs far less than 128
  bits anyway: a rare collision merely merges two skeleton buckets, it
  cannot produce a wrong candidate. The position key itself stays 128-bit.
  Accepts a `t` or a canonical key string.
  """
  @spec pawn_hash(t() | String.t()) :: non_neg_integer()
  def pawn_hash(%__MODULE__{key: key}), do: pawn_hash(key)

  def pawn_hash(key) when is_binary(key) do
    key
    |> PositionKey.pawn_key()
    |> PositionKey.to_hash128()
    |> binary_part(0, 8)
    |> :binary.decode_unsigned()
    |> Bitwise.band(0x7FFFFFFFFFFFFFFF)
  end

  @doc "Pawn skeleton string (`PositionKey.pawn_key/1` applied to this key)."
  @spec pawn_key(t()) :: String.t()
  def pawn_key(%__MODULE__{key: key}), do: PositionKey.pawn_key(key)

  @doc "Pawn-set symmetric difference size (0 = identical skeleton)."
  @spec pawn_mismatches(t(), t()) :: non_neg_integer()
  def pawn_mismatches(a, b) do
    popcount(bxor(elem(a.boards, @wp), elem(b.boards, @wp))) +
      popcount(bxor(elem(a.boards, @bp), elem(b.boards, @bp)))
  end

  @doc "L1 distance between material signatures (0 = identical material)."
  @spec material_distance(t(), t()) :: non_neg_integer()
  def material_distance(a, b), do: tuple_l1(a.material, b.material, 0)

  @doc """
  Human-readable material delta of `cand` relative to `ref`, e.g.
  `"wP+1 bN-1"`. `"="` when identical.
  """
  @spec material_diff_description(t(), t()) :: String.t()
  def material_diff_description(ref, cand) do
    names = ["wP", "wN", "wB", "wR", "wQ", "bP", "bN", "bB", "bR", "bQ"]

    diffs =
      names
      |> Enum.with_index()
      |> Enum.flat_map(fn {name, i} ->
        delta = elem(cand.material, i) - elem(ref.material, i)

        cond do
          delta == 0 -> []
          delta > 0 -> ["#{name}+#{delta}"]
          true -> ["#{name}#{delta}"]
        end
      end)

    case diffs do
      [] -> "="
      _ -> Enum.join(diffs, " ")
    end
  end

  @doc """
  Non-pawn, non-king piece placement overlap: `matches` counts pieces on
  identical squares (summed over color and type), `mismatches` is the
  symmetric difference size, `ref_pieces` the reference's total such pieces.
  """
  @spec piece_overlap(t(), t()) ::
          %{
            matches: non_neg_integer(),
            mismatches: non_neg_integer(),
            ref_pieces: non_neg_integer()
          }
  def piece_overlap(ref, cand) do
    {matches, mismatches, ref_pieces} =
      Enum.reduce(@piece_idxs, {0, 0, 0}, fn i, {m, mm, rp} ->
        r = elem(ref.boards, i)
        c = elem(cand.boards, i)
        {m + popcount(r &&& c), mm + popcount(bxor(r, c)), rp + popcount(r)}
      end)

    %{matches: matches, mismatches: mismatches, ref_pieces: ref_pieces}
  end

  @doc "Sum of per-color Chebyshev king distances (0 = kings on the same squares)."
  @spec king_distance(t(), t()) :: non_neg_integer()
  def king_distance(a, b) do
    chebyshev(lsb(elem(a.boards, @wk)), lsb(elem(b.boards, @wk))) +
      chebyshev(lsb(elem(a.boards, @bk)), lsb(elem(b.boards, @bk)))
  end

  @doc "Minor pieces (N/B) off their home squares, per color."
  @spec developed(t()) :: %{w: non_neg_integer(), b: non_neg_integer()}
  def developed(f) do
    # home squares: b1=57 c1=58 f1=61 g1=62 (white); b8=1 c8=2 f8=5 g8=6 (black)
    w_home = 1 <<< 57 ||| 1 <<< 58 ||| 1 <<< 61 ||| 1 <<< 62
    b_home = 1 <<< 1 ||| 1 <<< 2 ||| 1 <<< 5 ||| 1 <<< 6

    w_minor = elem(f.boards, @wn) ||| elem(f.boards, @wb)
    b_minor = elem(f.boards, @bn) ||| elem(f.boards, @bb)

    %{
      w: popcount(w_minor) - popcount(w_minor &&& w_home),
      b: popcount(b_minor) - popcount(b_minor &&& b_home)
    }
  end

  @doc "Total pieces on the board (both colors, kings included)."
  @spec piece_count(t()) :: non_neg_integer()
  def piece_count(f) do
    f.boards
    |> Tuple.to_list()
    |> Enum.reduce(0, fn board, acc -> acc + popcount(board) end)
  end

  @doc "Occupancy bitboard (all pieces, both colors)."
  @spec occupancy(t()) :: non_neg_integer()
  def occupancy(f) do
    f.boards
    |> Tuple.to_list()
    |> Enum.reduce(0, fn board, acc -> acc ||| board end)
  end

  ## Bit helpers

  @doc """
  Population count of a non-negative integer (SWAR bithack over the low 64
  bits; feature bitboards never exceed 64 bits).
  """
  @spec popcount(non_neg_integer()) :: non_neg_integer()
  def popcount(x) when is_integer(x) and x >= 0 do
    x = x - (x >>> 1 &&& 0x5555555555555555)
    x = (x &&& 0x3333333333333333) + (x >>> 2 &&& 0x3333333333333333)
    x = x + (x >>> 4) &&& 0x0F0F0F0F0F0F0F0F
    (x * 0x0101010101010101 &&& @mask64) >>> 56
  end

  @doc "Index of the least significant set bit (king boards have exactly one)."
  @spec lsb(non_neg_integer()) :: non_neg_integer() | nil
  def lsb(0), do: nil
  def lsb(x), do: do_lsb(x &&& -x, 0)

  defp do_lsb(1, n), do: n
  defp do_lsb(v, n), do: do_lsb(v >>> 1, n + 1)

  defp chebyshev(nil, _), do: 8
  defp chebyshev(_, nil), do: 8

  defp chebyshev(sq1, sq2) do
    max(abs(rem(sq1, 8) - rem(sq2, 8)), abs(div(sq1, 8) - div(sq2, 8)))
  end

  defp tuple_l1(a, b, i) when i < tuple_size(a) do
    abs(elem(a, i) - elem(b, i)) + tuple_l1(a, b, i + 1)
  end

  defp tuple_l1(_a, _b, _i), do: 0

  defp bxor(a, b), do: :erlang.bxor(a, b)

  ## Placement parsing

  defp place_row(row, base, boards) do
    row
    |> String.to_charlist()
    |> Enum.reduce({boards, 0}, fn ch, {acc, col} ->
      if ch >= ?1 and ch <= ?8 do
        {acc, col + (ch - ?0)}
      else
        {set_piece(acc, piece_index(ch), base + col), col + 1}
      end
    end)
    |> elem(0)
  end

  defp set_piece(boards, idx, sq), do: put_elem(boards, idx, elem(boards, idx) ||| 1 <<< sq)

  defp piece_index(?P), do: @wp
  defp piece_index(?N), do: @wn
  defp piece_index(?B), do: @wb
  defp piece_index(?R), do: @wr
  defp piece_index(?Q), do: @wq
  defp piece_index(?K), do: @wk
  defp piece_index(?p), do: @bp
  defp piece_index(?n), do: @bn
  defp piece_index(?b), do: @bb
  defp piece_index(?r), do: @br
  defp piece_index(?q), do: @bq
  defp piece_index(?k), do: @bk
end
