defmodule Blunderfest.Corpus.Analysis.Route do
  @moduledoc """
  Route comparison (design brief §9, port of Spike 05's route analysis):
  how the two games reached the (near-)shared position.

  The comparison is mechanical, not interpretative:

    * how many plies the two routes share;
    * the first diverging ply and the move each side played there;
    * the moves each side spent from the divergence to its position;
    * the multiset differences (`extra` / `missing`) per side — the raw
      material for a tempo/deviation reading (e.g. "candidate white played
      e3 where the reference played e4 in one go, reaching the equivalent
      position one ply later").

  The brief's objective is to make the relationship explicit so the user
  can interpret it — nothing here declares a strategic error.

  Moves are compared as raw SAN tokens (as extracted from the corpus
  mainlines). Ply numbers are 1-based; odd plies are white moves. When the
  analysis has no reference route (a bare FEN), `shared_plies` is 0 and
  only the candidate side is filled in.
  """

  @type route :: %{
          shared_plies: non_neg_integer(),
          diverged_ply: non_neg_integer() | nil,
          ref_move: String.t() | nil,
          cand_move: String.t() | nil,
          ref_segment: %{white: [String.t()], black: [String.t()]},
          cand_segment: %{white: [String.t()], black: [String.t()]},
          extra: %{white: [String.t()], black: [String.t()]},
          missing: %{white: [String.t()], black: [String.t()]},
          ref_ply: non_neg_integer() | nil,
          cand_ply: non_neg_integer(),
          ply_gap: non_neg_integer()
        }

  @doc """
  Compares the two games' routes to the (near-)shared position. `ref_moves`
  is the reference game's full mainline (or nil for a bare FEN analysis),
  `ref_ply` the ply of the reference position within it; `cand_moves` and
  `cand_ply` are the candidate's.
  """
  @spec compare([String.t()] | nil, non_neg_integer() | nil, [String.t()], non_neg_integer()) ::
          route()
  def compare(ref_moves, ref_ply, cand_moves, cand_ply) do
    cand_segment = cand_moves |> Enum.take(cand_ply) |> segment_from(1)

    if ref_moves == nil do
      %{
        shared_plies: 0,
        diverged_ply: nil,
        ref_move: nil,
        cand_move: Enum.at(cand_moves, cand_ply - 1),
        ref_segment: %{white: [], black: []},
        cand_segment: cand_segment,
        extra: %{white: [], black: []},
        missing: %{white: [], black: []},
        ref_ply: nil,
        cand_ply: cand_ply,
        ply_gap: 0
      }
    else
      prefix_len = common_prefix(ref_moves, cand_moves)
      diverged_ply = prefix_len + 1

      ref_segment = ref_moves |> Enum.slice(prefix_len, max(ref_ply - prefix_len, 0))
      cand_segment = cand_moves |> Enum.slice(prefix_len, max(cand_ply - prefix_len, 0))

      {ref_white, ref_black} = split_by_side(ref_segment, diverged_ply)
      {cand_white, cand_black} = split_by_side(cand_segment, diverged_ply)

      %{
        shared_plies: prefix_len,
        diverged_ply: diverged_ply,
        ref_move: Enum.at(ref_moves, prefix_len),
        cand_move: Enum.at(cand_moves, prefix_len),
        ref_segment: %{white: ref_white, black: ref_black},
        cand_segment: %{white: cand_white, black: cand_black},
        extra: %{
          white: msdiff(cand_white, ref_white),
          black: msdiff(cand_black, ref_black)
        },
        missing: %{
          white: msdiff(ref_white, cand_white),
          black: msdiff(ref_black, cand_black)
        },
        ref_ply: ref_ply,
        cand_ply: cand_ply,
        ply_gap: cand_ply - ref_ply
      }
    end
  end

  defp segment_from(moves, start_ply) do
    {white, black} = split_by_side(moves, start_ply)
    %{white: white, black: black}
  end

  defp common_prefix(a, b) do
    a
    |> Enum.zip(b)
    |> Enum.take_while(fn {x, y} -> x == y end)
    |> length()
  end

  defp split_by_side(sans, start_ply) do
    sans
    |> Enum.with_index(start_ply)
    |> Enum.reduce({[], []}, fn {san, ply}, {white, black} ->
      if rem(ply, 2) == 1, do: {[san | white], black}, else: {white, [san | black]}
    end)
    |> then(fn {white, black} -> {Enum.reverse(white), Enum.reverse(black)} end)
  end

  # Multiset difference: the elements of `a` left after canceling one copy
  # per element of `b`.
  defp msdiff(a, b) do
    fb = Enum.frequencies(b)

    {out, _} =
      Enum.map_reduce(a, fb, fn x, acc ->
        if Map.get(acc, x, 0) > 0, do: {nil, Map.update!(acc, x, &(&1 - 1))}, else: {x, acc}
      end)

    Enum.reject(out, &is_nil/1)
  end
end
