defmodule BlunderfestApi.Router do
  use BlunderfestApi, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/api/v1", BlunderfestApi do
    pipe_through :api
  end

  # Enable LiveDashboard in development
  if Application.compile_env(:blunderfest_api, :dev_routes) do
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through [:fetch_session, :protect_from_forgery]

      live_dashboard "/dashboard", metrics: BlunderfestApi.Telemetry
    end
  end
end
