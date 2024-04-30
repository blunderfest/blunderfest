# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config

config :blunderfest,
  generators: [timestamp_type: :utc_datetime]

# Configures the endpoint
config :blunderfest, BlunderfestWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [json: BlunderfestWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: Blunderfest.PubSub,
  live_view: [signing_salt: "nCxsbKBL"]

# Configures Elixir's Logger
config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

config :nanoid,
  size: 10,
  alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

config :vite_phx,
  release_app: :blunderfest,
  # to tell prod and dev env apart
  environment: Mix.env(),
  # this manifest is different from the Phoenix "cache_manifest.json"!
  # optional
  vite_manifest: "priv/static/.vite/manifest.json",
  # optional
  phx_manifest: "priv/static/cache_manifest.json",
  # optional
  dev_server_address: "http://localhost:5173"

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{config_env()}.exs"
