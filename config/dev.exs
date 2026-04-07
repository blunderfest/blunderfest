import Config

config :blunderfest, BlunderfestWeb.Endpoint,
  http: [ip: {0, 0, 0, 0}, port: 8080],
  check_origin: false,
  code_reloader: true,
  debug_errors: true,
  secret_key_base: "dev_secret_key_base_that_is_at_least_64_bytes_long_for_development",
  watchers: [
    pnpm: :dev
  ]

config :blunderfest, Blunderfest.Storage,
  hot_storage_path: "data/hot",
  cold_storage_path: "data/cold",
  cache_size: 1_000_000_000

config :blunderfest, BlunderfestWeb.Endpoint,
  live_reload: [
    patterns: [
      ~r"priv/static/.*(js|css|png|jpeg|jpg|gif|svg)$",
      ~r"priv/gettext/.*(po)$",
      ~r"lib/blunderfest_web/(controllers|live|components)/.*(ex|heex)$"
    ]
  ]

config :logger, :console, format: "[$level] $message\n"

config :phoenix, :stacktrace_depth, 20

config :phoenix, :plug_init_mode, :runtime

config :phoenix_live_view,
  debug_heex_annotations: true,
  enable_expensive_runtime_checks: true
