defmodule Blunderfest.Corpus.Analysis.ContinuationTest do
  use ExUnit.Case, async: true

  alias Blunderfest.Corpus.Analysis.Continuation

  describe "normalize/1" do
    test "strips check, mate and annotation suffixes" do
      assert Continuation.normalize("exd4?!") == "exd4"
      assert Continuation.normalize("Qh5+") == "Qh5"
      assert Continuation.normalize("Qxh7#") == "Qxh7"
      assert Continuation.normalize("O-O-O") == "O-O-O"
    end
  end

  describe "window/3" do
    test "takes the n moves following a ply" do
      sans = ~w(e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7)

      assert Continuation.window(sans, 3, 4) == ~w(Nc6 Bb5 a6 Ba4)
      assert Continuation.window(sans, 8, 4) == ~w(O-O Be7)
    end
  end

  describe "by_side/2" do
    test "splits by mover, starting from the side to move" do
      assert Continuation.by_side(~w(Ne1 Ne8 Nd3 f5), :w) == %{
               w: ~w(Ne1 Nd3),
               b: ~w(Ne8 f5)
             }

      # A tempo flip: the same window starting with black buckets
      # identically per color.
      assert Continuation.by_side(~w(Ne8 Bg5 h6 Be3 f5 Qc1), :b) == %{
               b: ~w(Ne8 h6 f5),
               w: ~w(Bg5 Be3 Qc1)
             }
    end
  end

  describe "jaccard/2" do
    test "multiset-aware overlap" do
      assert Continuation.jaccard([], []) == 1.0
      assert Continuation.jaccard(["e4"], ["e4"]) == 1.0
      assert Continuation.jaccard(["e4"], ["d4"]) == 0.0

      # one shared of three union elements
      assert Continuation.jaccard(["a", "b"], ["a", "c"]) == 1.0 / 3.0
    end
  end

  describe "jaccard_freq/2" do
    test "matches jaccard/2 exactly, empty edges included" do
      assert Continuation.jaccard_freq(%{}, %{}) == 1.0
      assert Continuation.jaccard_freq(%{"e4" => 1}, %{}) == 0.0
      assert Continuation.jaccard_freq(%{}, %{"e4" => 1}) == 0.0
      assert Continuation.jaccard_freq(%{"a" => 1, "b" => 1}, %{"a" => 1, "c" => 1}) == 1.0 / 3.0

      # multiplicity: min/max per element
      assert Continuation.jaccard_freq(%{"a" => 2}, %{"a" => 1}) == 1.0 / 2.0
    end

    test "equals jaccard/2 over random multisets (HE-CPU parity)" do
      # The clustering and both membership layers compare via the
      # precomputed-frequency form; it must be exactly the list-form value.
      tokens = ~w(e4 e5 d4 d5 Nf3 Nc6 Nf6 Nc3 Bb5 Bc4 O-O a6)
      rng = :rand.seed_s(:exsss, {1, 2, 3})

      {pairs, _rng} =
        Enum.map_reduce(1..400, rng, fn _, r ->
          {la, r} = random_window(tokens, r)
          {lb, r} = random_window(tokens, r)
          {{la, lb}, r}
        end)

      for {a, b} <- pairs do
        assert Continuation.jaccard_freq(Enum.frequencies(a), Enum.frequencies(b)) ==
                 Continuation.jaccard(a, b)
      end
    end
  end

  defp random_window(tokens, rng) do
    {len, rng} = :rand.uniform_s(7, rng)

    Enum.map_reduce(1..(len - 1), rng, fn _, r ->
      {i, r} = :rand.uniform_s(length(tokens), r)
      {Enum.at(tokens, i - 1), r}
    end)
  end

  describe "lcs_similarity/2" do
    test "normalized LCS" do
      assert Continuation.lcs_similarity([], []) == 1.0
      assert Continuation.lcs_similarity([], ["e4"]) == 0.0

      # same content, different order: LCS of a b c vs b a c is 2
      assert Continuation.lcs_similarity(["a", "b", "c"], ["b", "a", "c"]) == 2 * 2 / 6
    end
  end

  describe "represent/3" do
    test "side_multiset survives a tempo flip" do
      ref = Continuation.represent(~w(Ne1 Ne8 Nd3 f5 Bd2 Kh8), :side_multiset, :w)
      twin = Continuation.represent(~w(Ne8 Bg5 h6 Be3 f5 Qc1), :side_multiset, :b)

      # The twin's black side overlaps the reference black side:
      # {Ne8, f5, Kh8} vs {Ne8, h6, f5} → 2/4.
      assert Continuation.jaccard(ref.b, twin.b) == 0.5
      assert Continuation.jaccard(ref.w, twin.w) == 0.0
    end

    test "piece_dest drops disambiguation and captures" do
      assert Continuation.piece_dest("Nbd7") == "N→d7"
      assert Continuation.piece_dest("fxe4") == "P→e4"
      assert Continuation.piece_dest("e8=Q") == "P→e8=Q"
      assert Continuation.piece_dest("O-O") == "O-O"
    end

    test "moving_piece classifies" do
      assert Continuation.moving_piece("e4") == "P"
      assert Continuation.moving_piece("Nf3") == "N"
      assert Continuation.moving_piece("O-O") == "K"
    end
  end
end
