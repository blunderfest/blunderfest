defmodule Blunderfest.Library do
  @moduledoc """
  Per-profile game library (ADR-0020): saved game trees — a member's copy of
  a room game, independent of the room's ephemeral lifecycle.

  Session-scoped, in-memory like everything else (ADR-0001): entries vanish
  on restart. Bounded per profile since memory is the budget.
  """

  use GenServer

  @max_entries_per_profile 50
  @max_tree_bytes 262_144

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: Keyword.get(opts, :name, __MODULE__))
  end

  @doc """
  Saves `tree` (JSON-shaped, string keys) to the profile's library. Returns
  `{:ok, entry}` or `{:error, :library_full | :tree_too_large | :invalid_tree}`.
  """
  def save(profile_id, tree, server \\ __MODULE__) do
    GenServer.call(server, {:save, profile_id, tree})
  end

  @doc "The profile's entries, newest first: `%{id, title, saved_at, tree}` maps."
  def list(profile_id, server \\ __MODULE__) do
    GenServer.call(server, {:list, profile_id})
  end

  def delete(profile_id, entry_id, server \\ __MODULE__) do
    GenServer.call(server, {:delete, profile_id, entry_id})
  end

  @doc "Drops all entries (test seam)."
  def reset(server \\ __MODULE__) do
    GenServer.call(server, :reset)
  end

  @impl true
  def init(_opts), do: {:ok, %{entries: %{}}}

  @impl true
  def handle_call({:save, profile_id, tree}, _from, state) do
    entries = Map.get(state.entries, profile_id, [])

    cond do
      length(entries) >= @max_entries_per_profile ->
        {:reply, {:error, :library_full}, state}

      not Blunderfest.Ops.valid_game_tree?(tree) ->
        {:reply, {:error, :invalid_tree}, state}

      byte_size(Jason.encode!(tree)) > @max_tree_bytes ->
        {:reply, {:error, :tree_too_large}, state}

      true ->
        entry = %{
          id: Base.url_encode64(:crypto.strong_rand_bytes(8), padding: false),
          title: title_for(tree),
          saved_at: DateTime.utc_now(),
          tree: tree
        }

        {:reply, {:ok, entry}, put_in(state, [:entries, profile_id], [entry | entries])}
    end
  end

  def handle_call({:list, profile_id}, _from, state) do
    {:reply, Map.get(state.entries, profile_id, []), state}
  end

  def handle_call({:delete, profile_id, entry_id}, _from, state) do
    entries =
      state.entries
      |> Map.get(profile_id, [])
      |> Enum.reject(&(&1.id == entry_id))

    {:reply, :ok, put_in(state, [:entries, profile_id], entries)}
  end

  def handle_call(:reset, _from, _state) do
    {:reply, :ok, %{entries: %{}}}
  end

  # "White – Black", falling back to the event name, then a plain default.
  defp title_for(tree) do
    headers = Map.get(tree, "headers", %{})

    case {Map.get(headers, "White"), Map.get(headers, "Black")} do
      {white, black} when is_binary(white) and is_binary(black) -> "#{white} – #{black}"
      _ -> Map.get(headers, "Event") || "Untitled game"
    end
  end
end
