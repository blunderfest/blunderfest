import Config

config :blunderfest,
  ecto_repos: [Blunderfest.Repo],
  generators: [timestamp_type: :utc_datetime]

config :blunderfest, BlunderfestWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [html: BlunderfestWeb.ErrorHTML, json: BlunderfestWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: Blunderfest.PubSub,
  live_view: [signing_salt: "blunderfest_secret"]

config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

config :phoenix, :json_library, Jason

config :blunderfest, Blunderfest.Storage,
  hot_storage_path: System.get_env("HOT_STORAGE_PATH", "/var/lib/blunderfest/hot"),
  cold_storage_path: System.get_env("COLD_STORAGE_PATH", "s3://blunderfest-cold"),
  cache_size: System.get_env("CACHE_SIZE", "8000000000") |> String.to_integer()

import_config "#{config_env()}.exs"
