defmodule Blunderfest.Endpoint do
  use Phoenix.Endpoint, otp_app: :blunderfest

  @session_options [
    store: :cookie,
    key: "_blunderfest_key",
    signing_salt: "blunderfest_signing_salt",
    same_site: "Lax",
    max_age: 2_592_000,
    secure: true
  ]

  socket "/live", Phoenix.LiveView.Socket,
    websocket: [connect_info: [session: @session_options]],
    longpoll: false

  socket "/ws", BlunderfestWeb.UserSocket,
    websocket: true,
    longpoll: false

  plug Plug.Static,
    at: "/",
    from: :blunderfest,
    gzip: false,
    only: BlunderfestWeb.static_paths()

  if code_reloading? do
    plug Phoenix.CodeReloader
    plug Phoenix.Ecto.CheckRepoStatus, otp_app: :blunderfest
  end

  plug Phoenix.LiveDashboard.RequestLogger,
    param_key: "request_logger",
    cookie_key: "request_logger"

  plug Plug.RequestId
  plug Plug.Telemetry, event_prefix: [:phoenix, :endpoint]

  plug Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Phoenix.json_library()

  plug Plug.MethodOverride
  plug Plug.Head
  plug Plug.Session, @session_options
  plug BlunderfestWeb.Router
end
