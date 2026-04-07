import Config

config :blunderfest, BlunderfestWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [json: BlunderfestWeb.ErrorJSON],
    layout: false
  ],
  live_view: [signing_salt: "blunderfest_secret"]

config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

config :phoenix, :json_library, Jason

config :blunderfest, Blunderfest.Storage,
  hot_storage_path: System.get_env("HOT_STORAGE_PATH", "./data/hot"),
  cold_storage_path: System.get_env("COLD_STORAGE_PATH", "./data/cold"),
  cache_size: System.get_env("CACHE_SIZE", "8000000000") |> String.to_integer()

import_config "#{config_env()}.exs"
