import Config

# Configure the Phoenix development server with Vite watcher
config :blunderfest_web, BlunderfestWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 8080],
  check_origin: false,
  code_reloader: true,
  debug_errors: true,
  secret_key_base: "dev_secret_key_base_at_least_64_chars_long_for_development_only",
  watchers: [
    pnpm: [
      "run",
      "dev",
      "--",
      "--host",
      "--port",
      "5173",
      cd: Path.expand("../assets", __DIR__)
    ]
  ]

# Watch static and templates for code reloading
config :blunderfest_web, BlunderfestWeb.Endpoint,
  live_reload: [
    patterns: [
      ~r"priv/static/.*(js|css|png|jpeg|jpg|gif|svg)$",
      ~r"priv/gettext/.*(po)$",
      ~r"lib/blunderfest_web/(controllers|live|components)/.*(ex|heex)$"
    ]
  ]

# Enable dev routes for dashboard, etc.
config :blunderfest_web, dev_routes: true

# Do not include debug breadcrumbs in production
config :phoenix, :stacktrace_depth, 1
