import Config

config :blunderfest, Blunderfest.Repo,
  username: "postgres",
  password: "postgres",
  hostname: "localhost",
  database: "blunderfest_test#{System.get_env("MIX_TEST_PARTITION")}",
  pool: Ecto.Adapters.SQL.Sandbox,
  pool_size: System.schedulers_online() * 2

config :blunderfest, BlunderfestWeb.Endpoint,
  http: [ip: {0, 0, 0, 0}, port: 8080],
  secret_key_base: "test_secret_key_base_that_is_at_least_64_bytes_long_for_testing",
  server: false

config :blunderfest, Blunderfest.Storage,
  hot_storage_path: "tmp/test_hot",
  cold_storage_path: "tmp/test_cold",
  cache_size: 100_000_000

config :logger, :console, format: "[$level] $message\n", level: :warning

config :phoenix, :plug_init_mode, :runtime
