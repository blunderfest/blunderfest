defmodule Blunderfest.Core.Bitboard do
  @moduledoc """
  Represents a bit board.
  """

  import Bitwise

  @dark_squares 0xAA55AA55AA55AA55

  def dark_squares(), do: @dark_squares

  def shift_right(bitboard, value),
    do: Bitwise.bsr(bitboard, value)

  def intersect(bitboard, value),
    do: Bitwise.band(bitboard, value)

  def union(bitboard, value),
    do: Bitwise.bor(bitboard, value)

  def complement(bitboard),
    do: Bitwise.bnot(bitboard)

  def toggle(bitboard, square_index),
    do: Bitwise.bxor(bitboard, from_square_index(square_index))

  def set?(bitboard, square_index),
    do: intersect(bitboard, from_square_index(square_index)) == 1

  def from_square_index(square_index), do: 1 <<< square_index
end
