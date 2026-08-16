defmodule BlunderfestWeb.Router do
  use BlunderfestWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/api", BlunderfestWeb do
    pipe_through :api

    get "/healthz", HealthController, :check
    post "/profiles", ProfileController, :create
    get "/profiles/:id", ProfileController, :show
    post "/rooms", RoomController, :create
    post "/import/pgn", ImportController, :pgn
    post "/import/lichess", ImportController, :lichess

    get "/profiles/:id/library", LibraryController, :index
    post "/profiles/:id/library", LibraryController, :create
    delete "/profiles/:id/library/:entry_id", LibraryController, :delete

    post "/auth/lichess/start", AuthController, :lichess_start
    post "/auth/exchange", AuthController, :exchange
    post "/auth/unlink", AuthController, :unlink

    get "/lichess/studies", LichessController, :studies
    post "/import/lichess-study", LichessController, :import_study
  end

  scope "/auth", BlunderfestWeb do
    get "/lichess/callback", AuthController, :lichess_callback
  end

  # The single-page application shell. Everything that is not a JSON API
  # route, a channel socket, or a static asset falls through to the app.
  # Channel sockets are mounted on the endpoint and never reach this router.
  get "/*path", BlunderfestWeb.SpaController, :index
end
