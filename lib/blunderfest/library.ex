defmodule Blunderfest.Library do
  @moduledoc """
  Per-profile game library (ADR-0020, ADR-0029): saved game trees — a
  member's copy of a room game, independent of the room's ephemeral
  lifecycle. Durable now: entries cross devices and survive deploys.
  """

  import Ecto.Query

  alias Blunderfest.Library.Entry
  alias Blunderfest.Repo

  @max_entries_per_profile 50
  @max_tree_bytes 262_144

  @doc """
  Saves `tree` (JSON-shaped, string keys) to the profile's library. Returns
  `{:ok, entry}` or `{:error, :library_full | :tree_too_large | :invalid_tree}`.
  """
  def save(profile_id, tree) do
    count = Repo.aggregate(from(e in Entry, where: e.profile_id == ^profile_id), :count)

    cond do
      count >= @max_entries_per_profile ->
        {:error, :library_full}

      not Blunderfest.Ops.valid_game_tree?(tree) ->
        {:error, :invalid_tree}

      byte_size(Jason.encode!(tree)) > @max_tree_bytes ->
        {:error, :tree_too_large}

      true ->
        entry = %Entry{
          id: new_id(),
          profile_id: profile_id,
          tree: tree,
          saved_at: DateTime.utc_now()
        }

        {:ok, _} = Repo.insert(entry)
        {:ok, to_map(entry)}
    end
  end

  @doc "The profile's entries, newest first: `%{id, title, saved_at, tree}` maps."
  def list(profile_id) do
    from(e in Entry, where: e.profile_id == ^profile_id, order_by: [desc: e.saved_at])
    |> Repo.all()
    |> Enum.map(&to_map/1)
  end

  def delete(profile_id, entry_id) do
    from(e in Entry, where: e.profile_id == ^profile_id and e.id == ^entry_id)
    |> Repo.delete_all()

    :ok
  end

  @doc "Drops all entries (test seam)."
  def reset do
    Repo.delete_all(Entry)
    :ok
  end

  defp to_map(entry) do
    %{id: entry.id, title: title_for(entry.tree), saved_at: entry.saved_at, tree: entry.tree}
  end

  # "White – Black", falling back to the event name, then a plain default.
  defp title_for(tree) do
    headers = Map.get(tree, "headers", %{})

    case {Map.get(headers, "White"), Map.get(headers, "Black")} do
      {white, black} when is_binary(white) and is_binary(black) -> "#{white} – #{black}"
      _ -> Map.get(headers, "Event") || "Untitled game"
    end
  end

  defp new_id do
    :crypto.strong_rand_bytes(8)
    |> Base.url_encode64(padding: false)
  end
end
