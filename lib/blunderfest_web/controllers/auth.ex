defmodule BlunderfestWeb.Auth do
  @moduledoc """
  Shared device authentication for controllers: a profile proven by the
  `Authorization: Bearer <secret>` header plus a `profile_id` param.
  """

  import Plug.Conn, only: [get_req_header: 2]

  alias Blunderfest.Profiles
  alias Blunderfest.Profiles.Profile

  @spec bearer_profile(Plug.Conn.t()) :: {:ok, Profile.t()} | :error
  def bearer_profile(conn) do
    with ["Bearer " <> secret] <- get_req_header(conn, "authorization"),
         {:ok, id} <- Map.fetch(conn.params, "profile_id"),
         true <- Profiles.authenticate(id, secret),
         {:ok, profile} <- Profiles.get(id) do
      {:ok, profile}
    else
      _ -> :error
    end
  end

  @doc "The profile's lichess account (`%{token, username, ...}`), when linked."
  @spec lichess_account(Profile.t()) :: map() | nil
  def lichess_account(%Profile{accounts: accounts}) do
    Enum.find(accounts, &(&1.type == "lichess"))
  end
end
