defmodule BlunderfestWeb.Router do
  use BlunderfestWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :protect_from_forgery
    plug :put_secure_browser_headers
  end

  scope "/", BlunderfestWeb do
    pipe_through :browser

    get "/", RoomController, :index
    get "/:room_code", RoomController, :index
  end

  # Enable LiveDashboard in development
  if Application.compile_env(:blunderfest, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through [:fetch_session, :protect_from_forgery]

      live_dashboard "/dashboard", metrics: BlunderfestWeb.Telemetry
    end
  end
end
