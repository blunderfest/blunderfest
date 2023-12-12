defmodule BlunderfestWeb.Presence do
  alias Blunderfest.Game.IdGenerator
  alias Blunderfest.Game.State.Room

  use Phoenix.Presence,
    otp_app: :blunderfest,
    pubsub_server: Blunderfest.PubSub

  @roomTopic "room:"

  @spec track_user(Phoenix.Socket.t(), Room.room_code(), IdGenerator.id()) ::
          {:error, any()} | {:ok, binary()}
  def track_user(socket, room_code, user_id) do
    track(socket, @roomTopic <> room_code, %{users: %{user_id: user_id}})
  end

  @spec list_users(Room.room_code()) :: list()
  def list_users(room_code) do
    list(@roomTopic)
    |> Map.get(room_code, %{metas: []})
    |> Map.get(:metas)
    |> users_from_metas()
  end

  defp users_from_metas(metas) do
    Enum.map(metas, &get_in(&1, [:users]))
    |> List.flatten()
    |> Enum.map(&Map.get(&1, :user_id))
    |> Enum.uniq()
  end
end
