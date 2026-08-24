defmodule Blunderfest.Corpus.PositionKey do
  @moduledoc """
  Canonical position keys for exact position retrieval (port of Spike 01).

  A position key identifies the *chess position* — the information required
  to reconstruct the board state and determine the legal continuation:

      <piece placement> <side to move> <castling rights> <en passant>

  The FEN move counters (halfmove clock, fullmove number) are **not** part
  of the key: they describe history, not the position.

  ## The en passant convention

  The FEN spec records the en passant target square after *every* double
  pawn push, even when no pawn can capture en passant. That makes the EP
  field history-dependent noise: `1.e4` yields `... b KQkq e3`, while the
  identical placement reached via `1.e3 d6 2.e4` yields `... b KQkq -`. The
  positions have identical legal continuations, so retrieval treats them as
  the same position.

  This module follows the X-FEN/Shredder-FEN convention: **the EP field is
  part of the key only when a legal en passant capture exists**. This
  requires a legality check at key-computation time — cheap, because it only
  runs on plies immediately following a double pawn push, and only when an
  adjacent enemy pawn exists. Positions that differ only in a *capturable*
  EP square get different keys (their legal move sets genuinely differ); a
  *pinned* EP capture (pseudo-legal but illegal) does not enter the key.

  `raw_from_game/1` exposes the naive FEN-convention key so corpus import
  can measure how often the two conventions diverge in practice.

  ## Binary form

  `to_hash128/1` maps the canonical string to 16 bytes (BLAKE2b, truncated).
  Deterministic and version-stable — deliberately *not* `Echecs.Zobrist`,
  whose keys are compile-time-seeded (they would silently change if the
  dependency's key generation ever changed, invalidating a persisted corpus)
  and which includes the EP file whenever the raw EP square is set (the
  convention rejected above). At hundreds of millions of positions a 64-bit
  hash has a measurable birthday-collision probability; 128 bits makes
  collisions negligible.
  """

  alias Echecs.Board

  import Bitwise, only: [&&&: 2]

  @doc """
  Canonical key for a game state: `"<placement> <w|b> <castling> <ep|->"`,
  where the EP square is included only when a legal EP capture exists.
  """
  @spec from_game(Echecs.Game.t()) :: String.t()
  def from_game(%Echecs.Game{} = game) do
    key_parts(game, true)
  end

  @doc """
  Key under the raw FEN convention: the EP square is included whenever it
  is set, capturable or not. Used to measure convention divergence on the
  corpus.
  """
  @spec raw_from_game(Echecs.Game.t()) :: String.t()
  def raw_from_game(%Echecs.Game{} = game) do
    key_parts(game, false)
  end

  @doc """
  Canonical key for a FEN string (counters are dropped; the position is
  validated by parsing it).
  """
  @spec from_fen(String.t()) :: {:ok, String.t()} | {:error, term()}
  def from_fen(fen) when is_binary(fen) do
    game = Echecs.new_game(fen)
    {:ok, from_game(game)}
  rescue
    e -> {:error, {:invalid_fen, Exception.message(e)}}
  end

  @doc "128-bit binary form of a canonical key (BLAKE2b truncated to 16 bytes)."
  @spec to_hash128(String.t()) :: <<_::128>>
  def to_hash128(key) when is_binary(key) do
    binary_part(:crypto.hash(:blake2b, key), 0, 16)
  end

  @doc "Hex-encoded `to_hash128/1`, for line-oriented storage (TSV)."
  @spec to_hash128_hex(String.t()) :: String.t()
  def to_hash128_hex(key), do: Base.encode16(to_hash128(key), case: :lower)

  @doc """
  Color-reversed transform of a canonical key: armies exchanged (piece case
  swapped, ranks mirrored), side to move toggled, castling rights swapped,
  EP square rank-mirrored. Files are *not* mirrored — a kingside setup stays
  kingside, matching the chess meaning of "colors reversed".

  Self-inverse: `color_flip(color_flip(key)) == key`.
  """
  @spec color_flip(String.t()) :: String.t()
  def color_flip(key) when is_binary(key) do
    [placement, stm, castling, ep] = String.split(key, " ")

    flipped_placement =
      placement
      |> String.split("/", trim: true)
      |> Enum.reverse()
      |> Enum.map_join("/", &swap_case_row/1)

    flipped_stm = if stm == "w", do: "b", else: "w"

    # Re-emit in canonical KQkq order: per-char case swap alone would
    # scramble the order ("Qk" -> "qK").
    flipped_castling =
      [
        if(String.contains?(castling, "k"), do: "K"),
        if(String.contains?(castling, "q"), do: "Q"),
        if(String.contains?(castling, "K"), do: "k"),
        if(String.contains?(castling, "Q"), do: "q")
      ]
      |> Enum.join()
      |> case do
        "" -> "-"
        s -> s
      end

    flipped_ep =
      case ep do
        "-" -> "-"
        <<file, rank>> -> <<file, ?1 + (?8 - rank)>>
      end

    Enum.join([flipped_placement, flipped_stm, flipped_castling, flipped_ep], " ")
  end

  @doc """
  Pawn-structure key: the placement with all non-pawn pieces removed
  (side to move, castling and EP dropped). Probe for structural prefilters
  (ADR-0010): positions with identical pawn skeletons share this key.
  """
  @spec pawn_key(String.t()) :: String.t()
  def pawn_key(key) when is_binary(key) do
    [placement | _] = String.split(key, " ")

    placement
    |> String.split("/", trim: true)
    |> Enum.map_join("/", &pawns_only_row/1)
  end

  ## Internal

  defp key_parts(game, normalize_ep?) do
    ep =
      if game.en_passant != nil do
        if normalize_ep? and not ep_capturable?(game),
          do: "-",
          else: Board.to_algebraic(game.en_passant)
      else
        "-"
      end

    IO.iodata_to_binary([
      placement(game.board),
      ?\s,
      stm(game.turn),
      ?\s,
      castling(game.castling),
      ?\s,
      ep
    ])
  end

  # The four key fields are generated directly from the game state (one pass
  # over the board tuple) — measurably faster than rendering a full FEN with
  # counters and re-splitting it, which matters at hundreds of millions of
  # plies.
  defp placement(board) when is_tuple(board) do
    Enum.map_intersperse(0..7, ?/, fn row -> placement_row(board, row * 8) end)
  end

  defp placement_row(board, base) do
    {parts, empty} =
      Enum.reduce(0..7, {[], 0}, fn col, {parts, empty} ->
        case Board.at_tuple(board, base + col) do
          nil ->
            {parts, empty + 1}

          piece ->
            if empty > 0,
              do: {[piece_char(piece), ?0 + empty | parts], 0},
              else: {[piece_char(piece) | parts], 0}
        end
      end)

    parts = if empty > 0, do: [?0 + empty | parts], else: parts
    Enum.reverse(parts)
  end

  defp piece_char({:white, :pawn}), do: ?P
  defp piece_char({:white, :knight}), do: ?N
  defp piece_char({:white, :bishop}), do: ?B
  defp piece_char({:white, :rook}), do: ?R
  defp piece_char({:white, :queen}), do: ?Q
  defp piece_char({:white, :king}), do: ?K
  defp piece_char({:black, :pawn}), do: ?p
  defp piece_char({:black, :knight}), do: ?n
  defp piece_char({:black, :bishop}), do: ?b
  defp piece_char({:black, :rook}), do: ?r
  defp piece_char({:black, :queen}), do: ?q
  defp piece_char({:black, :king}), do: ?k

  defp stm(:white), do: ?w
  defp stm(:black), do: ?b

  defp castling(0), do: ?-

  defp castling(rights) do
    parts = [
      if((rights &&& 1) != 0, do: ?K, else: []),
      if((rights &&& 2) != 0, do: ?Q, else: []),
      if((rights &&& 4) != 0, do: ?k, else: []),
      if((rights &&& 8) != 0, do: ?q, else: [])
    ]

    IO.iodata_to_binary(parts)
  end

  # Is a legal en passant capture available in this position? Only called
  # when the raw EP square is set (i.e. the previous move was a double pawn
  # push), so the common case is a cheap adjacency check; the full legality
  # check (which must rule out the pinned-EP case) only runs when a capturer
  # exists.
  defp ep_capturable?(%Echecs.Game{} = game) do
    capturer_present? =
      game
      |> ep_capturer_squares()
      |> Enum.any?(fn sq -> Board.at_tuple(game.board, sq) == {game.turn, :pawn} end)

    capturer_present? and
      game |> Echecs.legal_moves() |> Enum.any?(&(&1.special == :en_passant))
  end

  # Squares from which the side to move could capture en passant: the squares
  # adjacent (same rank) to the pawn that just double-pushed. Board indices
  # run a8=0 .. h1=63; the EP square is behind the pushed pawn (rank 3 for a
  # white push, rank 6 for a black push).
  defp ep_capturer_squares(%Echecs.Game{en_passant: nil}), do: []

  defp ep_capturer_squares(%Echecs.Game{en_passant: ep, turn: turn}) do
    # The pushed pawn sits one rank toward the pusher's home side from the
    # EP square: after a white push (e2-e4, EP e3) it is "above" (ep - 8);
    # after a black push (c7-c5, EP c6) it is "below" (ep + 8). Capturers of
    # `turn` stand beside that pawn. With side to move = black, white pushed.
    pushed_pawn = if turn == :black, do: ep - 8, else: ep + 8
    file = rem(pushed_pawn, 8)

    for df <- [-1, 1], (file + df) in 0..7, do: pushed_pawn + df
  end

  defp swap_case_row(row) do
    row
    |> String.graphemes()
    |> Enum.map_join(fn ch ->
      cond do
        ch >= "a" and ch <= "z" -> String.upcase(ch)
        ch >= "A" and ch <= "Z" -> String.downcase(ch)
        true -> ch
      end
    end)
  end

  defp pawns_only_row(row) do
    {out, empty} =
      row
      |> String.graphemes()
      |> Enum.reduce({[], 0}, fn ch, {out, empty} ->
        cond do
          ch == "p" or ch == "P" ->
            # `out` accumulates in reverse; a piece flushes pending empties.
            if empty > 0 do
              {[ch, Integer.to_string(empty) | out], 0}
            else
              {[ch | out], 0}
            end

          ch >= "1" and ch <= "8" ->
            {out, empty + String.to_integer(ch)}

          true ->
            # A removed non-pawn piece becomes one more empty square.
            {out, empty + 1}
        end
      end)

    out = if empty > 0, do: [Integer.to_string(empty) | out], else: out

    case out |> Enum.reverse() |> Enum.join() do
      "" -> "8"
      s -> s
    end
  end
end
