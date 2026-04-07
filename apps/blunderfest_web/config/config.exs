import Config

config :blunderfest_web,
  ecto_repos: [],
  generators: [timestamp_type: :utc_datetime],
  aliases: aliases()

config :blunderfest_web, BlunderfestWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [html: BlunderfestWeb.ErrorHTML, json: BlunderfestWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: BlunderfestWeb.PubSub,
  live_view: [signing_salt: "blunderfest_live_view_salt"]

config :blunderfest_web, BlunderfestWeb.Endpoint,
  server: true

config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

config :phoenix, :json_library, Jason

import_config "#{config_env()}.exs"

defp aliases do
  [
    setup: ["deps.get"],
    "assets.setup": ["cmd --cd assets pnpm install"],
    "assets.dev": ["cmd --cd assets pnpm run dev"],
    "assets.build": ["cmd --cd assets pnpm run build"],
    "assets.deploy": ["cmd --cd assets pnpm run build"]
  ]
end
