defmodule Blunderfest.Repo do
  use Ecto.Repo,
    otp_app: :blunderfest,
    adapter: Ecto.Adapters.Postgres
end
