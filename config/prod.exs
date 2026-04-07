import Config

config :blunderfest, BlunderfestWeb.Endpoint,
  url: [host: System.get_env("PHX_HOST") || "blunderfest.com", port: 443],
  force_ssl: [rewrite_on: [:x_forwarded_proto]],
  cache_static_manifest: "priv/static/cache_manifest.json"

config :blunderfest, Blunderfest.Storage,
  hot_storage_path: System.get_env("HOT_STORAGE_PATH", "/var/lib/blunderfest/hot"),
  cold_storage_path: System.get_env("COLD_STORAGE_PATH", "/var/lib/blunderfest/cold"),
  cache_size: System.get_env("CACHE_SIZE", "8000000000") |> String.to_integer()

config :logger, level: :info

config :phoenix, :serve_endpoints, true

config :phoenix, :plug_init_mode, :runtime
