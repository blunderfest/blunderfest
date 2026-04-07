import Config

# For development, we don't start the Vite watcher via Phoenix watchers
# since we typically run Vite in a separate terminal during development.
# Phoenix will serve the built static assets from priv/static instead.
#
# To run Vite alongside Phoenix:
# 1. In terminal 1: cd apps/blunderfest_api && mix phx.server
# 2. In terminal 2: cd apps/blunderfest_ui && pnpm run dev
#
# Or if you want Phoenix to automatically start Vite as a background process,
# you can add it to your application's start/2 callback in application.ex

# Configure the Elixir development server
config :blunderfest_api, BlunderfestApi.Dev.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 8080],
  check_origin: false,
  code_reloader: true,
  debug_errors: true,
  secret_key_base: "dev_secret_key_base_at_least_64_chars_long_for_development_only",
  watchers: []

# Watch static and templates for code reloading
config :blunderfest_api, BlunderfestApi.Dev.Endpoint,
  live_reload: [
    patterns: [
      ~r"priv/static/.*(js|css|png|jpeg|jpg|gif|svg)$",
      ~r"priv/gettext/.*(po)$",
      ~r"lib/blunderfest_api_web/(controllers|live|components)/.*(ex|heex)$"
    ]
  ]

# Enable dev routes for dashboard, etc.
config :blunderfest_api, dev_routes: true

# Do not include debug breadcrumbs in production
config :phoenix, :stacktrace_depth, 1

# Initialize gettext on boot for development
config :blunderfest_api, BlunderfestApi.Gettext, null_parent_locale: "en"
