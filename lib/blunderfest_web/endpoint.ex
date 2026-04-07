defmodule BlunderfestWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :blunderfest

  @session_options [
    store: :cookie,
    key: "_blunderfest_key",
    signing_salt: "blunderfest_signing_salt",
    same_site: "Lax"
  ]

  socket("/live", Phoenix.LiveView.Socket,
    websocket: [connect_info: [session: @session_options]],
    longpoll: false
  )

  socket("/ws", BlunderfestWeb.UserSocket)

  plug(Plug.Static,
    at: "/",
    from: {:app, :blunderfest, "priv/static"},
    gzip: true,
    only: BlunderfestWeb.static_paths()
  )

  if code_reloading? do
    plug(Phoenix.CodeReloader)
  end

  plug(Plug.RequestId)
  plug(Plug.Telemetry, event_prefix: [:phoenix, :endpoint])

  plug(Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Phoenix.json_library()
  )

  plug(Plug.MethodOverride)
  plug(Plug.Head)
  plug(Plug.Session, @session_options)
  plug(BlunderfestWeb.Router)
end
