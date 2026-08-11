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
  end

  # The single-page application shell. Everything that is not a JSON API
  # route, a channel socket, or a static asset falls through to the app.
  # Channel sockets are mounted on the endpoint and never reach this router.
  get "/*path", BlunderfestWeb.SpaController, :index
end
