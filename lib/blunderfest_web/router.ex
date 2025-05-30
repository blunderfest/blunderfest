defmodule BlunderfestWeb.Router do
  use BlunderfestWeb, :router

  pipeline :browser do
    # Accept HTML requests
    plug :accepts, ["html"]
    # Fetch the session for the request
    plug :fetch_session
    # Set the root layout
    plug :put_root_layout, {BlunderfestWeb.LayoutView, :root}
    # Protect against CSRF attacks
    plug :protect_from_forgery
    # Set security-related HTTP headers
    plug :put_secure_browser_headers
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/api", BlunderfestWeb do
    pipe_through :api

    get "/example", ExampleController, :index
    post "/example", ExampleController, :create
  end

  # Enable LiveDashboard and Swoosh mailbox preview in development
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
      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end
  end

  scope "/", BlunderfestWeb do
    pipe_through :browser

    get "/*path", PageController, :index
  end
end
