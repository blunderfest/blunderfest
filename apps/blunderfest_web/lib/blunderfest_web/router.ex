defmodule BlunderfestWeb.Router do
  use BlunderfestWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/api/v1", BlunderfestWeb do
    pipe_through :api
  end

  # Enable LiveDashboard in development
  if Application.compile_env(:blunderfest_web, :dev_routes) do
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through [:fetch_session, :protect_from_forgery]

      live_dashboard "/dashboard", metrics: BlunderfestWeb.Telemetry
    end
  end
end
