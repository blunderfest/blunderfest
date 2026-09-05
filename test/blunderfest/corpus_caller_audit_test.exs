defmodule Blunderfest.CorpusCallerAuditTest do
  @moduledoc """
  The Phase 3 caller audit, pinned as a regression guard: no product code
  reaches for an unbounded occurrence read when a bounded primitive
  suffices. Unbounded full-list reads belong to validation oracles and the
  explicitly named `all_occurrences/1` — never to a hot product path.
  """

  use ExUnit.Case, async: true

  defp product_sources do
    "lib/blunderfest/**/*.ex"
    |> Path.wildcard()
    # The facade itself defines the API surface.
    |> Enum.reject(&(&1 == "lib/blunderfest/corpus.ex"))
  end

  @call ~r/(?<pipe>\|>\s*)?(?:Blunderfest\.)?Corpus\.occurrences(?<args>\(([^)]*)\))?/

  test "no product module calls the unbounded Corpus.occurrences/1" do
    offenders =
      for path <- product_sources(),
          line <- String.split(File.read!(path), "\n"),
          call <- Regex.scan(@call, line),
          unbounded?(call) do
        "#{path}: #{String.trim(line)}"
      end

    assert offenders == []
  end

  # Regex.scan returns [full, pipe_group, args_group, inner]; the piped
  # value is the first argument, so `|> Corpus.occurrences(n)` is the
  # bounded arity, while `Corpus.occurrences(key)` is not. A name without
  # parens is a call only when piped (`key |> Corpus.occurrences` —
  # unbounded); otherwise it is a capture like `&Corpus.occurrences/1`.
  defp unbounded?([_full, pipe, "", _inner]), do: pipe != ""

  defp unbounded?([_full, pipe, args, _inner]) do
    arity =
      case String.split(args, ",", trim: true) do
        [""] -> 0
        parts -> length(parts)
      end

    arity + if(pipe == "", do: 0, else: 1) == 1
  end

  defp unbounded?(_), do: false

  test "the only all_occurrences product call site is the documented pipeline fallback" do
    calls =
      for path <- product_sources(),
          line <- String.split(File.read!(path), "\n"),
          line =~ "Corpus.all_occurrences(" do
        {path, String.trim(line)}
      end

    assert calls == [
             {"lib/blunderfest/corpus/search/pipeline.ex",
              "{Counts.counts(Blunderfest.Corpus.all_occurrences(key)), memo}"}
           ]
  end
end
