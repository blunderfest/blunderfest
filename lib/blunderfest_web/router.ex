defmodule BlunderfestWeb.Router do
  use BlunderfestWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :protect_from_forgery
    plug :put_secure_browser_headers
    plug BlunderfestWeb.UserId
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", BlunderfestWeb do
    pipe_through :browser

    get "/", PageController, :index
    get "/:room_code", PageController, :index
  end

  # Other scopes may use custom stacks.
  # scope "/api", BlunderfestWeb do
  #   pipe_through :api
  # end

  # Enable LiveDashboard in development
  if Application.compile_env(:blunderfest, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through :browser

      live_dashboard "/dashboard", metrics: BlunderfestWeb.Telemetry
    end
  end
end
