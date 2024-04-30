import Config

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :blunderfest, BlunderfestWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "eGFEs2fbjQuuK1CC5PUuz46uRKc6d2L+CoFcViADZWMvcS5eP32X3DP/KyHXmBnM",
  server: false

# Print only warnings and errors during test
config :logger, level: :warning

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime

config :phoenix_live_view,
  # Enable helpful, but potentially expensive runtime checks
  enable_expensive_runtime_checks: true
