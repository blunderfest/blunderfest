defmodule Blunderfest.Repo do
  @moduledoc """
  The application-data repository (ADR-0029): profiles, linked accounts,
  and the game library — the transactional half of persistence. The
  corpus (ADR-0026) and the room log (ADR-0028) keep their own
  Postgrex-direct boundaries; nothing else in the app touches Ecto.
  """

  use Ecto.Repo,
    otp_app: :blunderfest,
    adapter: Ecto.Adapters.Postgres
end
