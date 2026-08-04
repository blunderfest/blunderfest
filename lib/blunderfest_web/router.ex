defmodule BlunderfestWeb.Router do
  use BlunderfestWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/api", BlunderfestWeb do
    pipe_through :api

    get "/healthz", HealthController, :check
  end

  # The single-page application shell. Everything that is not a JSON API
  # route, a channel socket, or a static asset falls through to the app.
  # Channel sockets are mounted on the endpoint and never reach this router.
  get "/*path", BlunderfestWeb.SpaController, :index
end
