import Config

config :blunderfest_api,
  ecto_repos: [BlunderfestApi.Repo],
  generators: [timestamp_type: :utc_datetime],
  aliases: aliases()

config :blunderfest_api, BlunderfestApi.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [html: BlunderfestApi.ErrorHTML, json: BlunderfestApi.ErrorJSON],
    layout: false
  ],
  pubsub_server: BlunderfestApi.PubSub,
  live_view: [signing_salt: "blunderfest_live_view_salt"]

config :blunderfest_api, BlunderfestApi.Repo,
  pool_size: String.to_integer(System.get_env("POOL_SIZE") || "5"),
  ssl: false

config :blunderfest_api, BlunderfestApi.Endpoint,
  server: true

# Configures the mailer
config :blunderfest_api, BlunderfestApi.Mailer,
  adapter: Swoosh.Adapters.Local,
  smtp_port: 1025

config :blunderfest_api, dev_routes: true

config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

config :phoenix, :json_library, Jason

import_config "#{config_env()}.exs"

defp aliases do
  [
    setup: ["deps.get", "ecto.setup"],
    "ecto.setup": ["ecto.create", "ecto.migrate", "run priv/repo/seeds.exs"],
    "ecto.reset": ["ecto.drop", "ecto.setup"],
    dev: ["assets.setup"],
    "assets.setup": ["cmd --app blunderfest_ui pnpm install"],
    "assets.deploy": ["cmd --app blunderfest_ui pnpm run build"]
  ]
end
