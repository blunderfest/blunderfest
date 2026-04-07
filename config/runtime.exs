import Config

config :blunderfest, BlunderfestWeb.Endpoint,
  http: [ip: {0, 0, 0, 0}, port: System.get_env("PORT") || 8080],
  url: [host: System.get_env("PHX_HOST") || "localhost", port: 443],
  secret_key_base: System.get_env("SECRET_KEY_BASE") || raise("SECRET_KEY_BASE not set"),
  server: true,
  check_origin: false

config :blunderfest, Blunderfest.Storage,
  hot_storage_path: System.get_env("HOT_STORAGE_PATH", "/var/lib/blunderfest/hot"),
  cold_storage_path: System.get_env("COLD_STORAGE_PATH", "/var/lib/blunderfest/cold"),
  cache_size: System.get_env("CACHE_SIZE", "8000000000") |> String.to_integer()

config :logger, level: String.to_existing_atom(System.get_env("LOG_LEVEL") || "info")
