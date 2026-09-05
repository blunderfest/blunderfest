defmodule Blunderfest.CorpusPackedFacadeTest do
  # async: false — swaps the app-booted Corpus process' packed backend.
  use ExUnit.Case, async: false

  @moduletag :tmp_dir

  alias Blunderfest.Corpus
  alias Blunderfest.Corpus.Analysis.Features
  alias Blunderfest.Corpus.Packed
  alias Blunderfest.Corpus.Packed.{Builder, Manifest}
  alias Blunderfest.Corpus.PositionKey

  @key_a "8/8/8/8/8/8/8/K6k w - -"
  # Full FEN normalizing to @key_a (the facade's book_counts takes FENs).
  @fen_a "8/8/8/8/8/8/8/K6k w - - 0 1"
  @missing_fen "8/8/8/8/8/8/8/7K w - - 0 1"

  defp hash(key), do: PositionKey.to_hash128(key)

  # key_a: 3 occurrences in 2 games (gid 2 twice) — same_game_only shape.
  # The book records one continuation from one game, so the book-sum (1)
  # diverges from the true independent-game count (2): the Spike 09 §12.8
  # shape in miniature.
  defp fixture_occs do
    [{hash(@key_a), 1, 4}, {hash(@key_a), 2, 4}, {hash(@key_a), 2, 10}]
  end

  defp fixture_poss do
    [{hash(@key_a), Features.pawn_hash(@key_a), 1, 4, @key_a}]
  end

  defp fixture_books do
    [{hash(@key_a), [{"e5", 1, 1, 0, 0}]}]
  end

  defp build_dir!(dir, pos_version) do
    File.mkdir_p!(dir)

    poss =
      if pos_version == 2 do
        [{hash(@key_a), Features.pawn_hash(@key_a), 1, 4, @key_a, 3, 2, 0}]
      else
        fixture_poss()
      end

    entry =
      Builder.build!(dir, "seg-000001", Enum.sort(fixture_occs()), poss, fixture_books(), 2,
        pos_version: pos_version
      )

    Manifest.write!(dir, [entry], entry.pos_version)
    dir
  end

  defp with_packed(dir, fun) do
    {:ok, backend} = Packed.open(dir)
    :sys.replace_state(Corpus, fn st -> %{st | packed: backend} end)

    try do
      fun.()
    after
      :sys.replace_state(Corpus, fn st -> %{st | packed: nil} end)
      Packed.close(backend)
    end
  end

  setup context do
    # The app boots in test env with the Postgres pool; restore whatever
    # packed state the process had (nil in the test config).
    prev = :sys.get_state(Corpus)

    on_exit(fn ->
      if Process.whereis(Corpus), do: :sys.replace_state(Corpus, fn _ -> prev end)
    end)

    %{
      v1_dir: build_dir!(Path.join(context.tmp_dir, "packed-v1"), 1),
      v2_dir: build_dir!(Path.join(context.tmp_dir, "packed-v2"), 2)
    }
  end

  test "position_stats serves v2 from stored metadata and matches v1", %{
    v1_dir: v1,
    v2_dir: v2
  } do
    for dir <- [v1, v2] do
      with_packed(dir, fn ->
        assert Corpus.position_stats(@key_a) == %{occurrences: 3, games: 2}
        assert Corpus.position_stats("8/8/8/8/8/8/8/7K w - -") == %{occurrences: 0, games: 0}

        # The legacy alias answers identically.
        assert Corpus.occurrence_counts(@key_a) == Corpus.position_stats(@key_a)
      end)
    end
  end

  test "first_occurrence equals the full-list head without the run", %{
    v1_dir: v1,
    v2_dir: v2
  } do
    for dir <- [v1, v2] do
      with_packed(dir, fn ->
        assert Corpus.first_occurrence(@key_a) == {1, 4}
        assert Corpus.first_occurrence(@key_a) == Corpus.all_occurrences(@key_a) |> List.first()
        assert Corpus.first_occurrence("8/8/8/8/8/8/8/7K w - -") == nil
      end)
    end
  end

  test "bounded occurrences are the all-occurrences prefix at every limit", %{
    v1_dir: v1,
    v2_dir: v2
  } do
    for dir <- [v1, v2] do
      with_packed(dir, fn ->
        all = Corpus.all_occurrences(@key_a)
        assert all == [{1, 4}, {2, 4}, {2, 10}]
        # The legacy unbounded alias returns the same list.
        assert Corpus.occurrences(@key_a) == all

        for limit <- [0, 1, 2, 3, 4, 2000] do
          assert Corpus.occurrences(@key_a, limit) == Enum.take(all, limit)
        end

        assert Corpus.occurrences("8/8/8/8/8/8/8/7K w - -", 5) == []
      end)
    end
  end

  test "book_counts serves the authoritative independent-game count", %{
    v1_dir: v1,
    v2_dir: v2
  } do
    for dir <- [v1, v2] do
      with_packed(dir, fn ->
        # The true count is 2 (gids 1 and 2); the book's per-move sum is 1
        # (gid 2's game has no recorded continuation). Phase 3 serves the
        # authoritative number on both format versions.
        assert Corpus.book_counts([@fen_a]) == %{@fen_a => 2}
        assert Corpus.book_counts([@missing_fen]) == %{}
      end)
    end

    # The divergence the fix closes: the raw book sum still disagrees.
    with_packed(v2, fn ->
      assert Packed.book_games_count(:sys.get_state(Corpus).packed, hash(@key_a)) == 1
    end)
  end
end
