defmodule BlunderfestWeb.Router do
  use BlunderfestWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/api", BlunderfestWeb do
    pipe_through :api
  end

  scope "/", BlunderfestWeb do
    get "/", PageController, :index
  end

  # Enable LiveDashboard and Swoosh mailbox preview in development
  if Application.compile_env(:blunderfest, :dev_routes) do
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through [:fetch_session, :protect_from_forgery]

      live_dashboard "/dashboard", metrics: BlunderfestWeb.Telemetry
      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end
  end
end
