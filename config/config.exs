# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config

config :blunderfest,
  generators: [timestamp_type: :utc_datetime],
  token_salt: "dNtV2qfw"

# Configures the endpoint
config :blunderfest, BlunderfestWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [html: BlunderfestWeb.ErrorHTML, json: BlunderfestWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: Blunderfest.PubSub,
  live_view: [signing_salt: "Wn4XkvsI"]

# Configures Elixir's Logger
config :logger, :console,
  format: "$node\t[$level]\t$message\n",
  metadata: [:request_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

config :nanoid,
  size: 10,
  alphabet: "23456789ABCDEFGHJKMNPRSTUVWXYZ"

# environment: :prod,

# Configure Vite
config :vite_phx,
  release_app: :blunderfest,
  environment: Mix.env(),
  vite_manifest: "priv/static/.vite/manifest.json",
  phx_manifest: "priv/static/cache_manifest.json",
  dev_server_address: "http://localhost:5173"

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{config_env()}.exs"
