import Config

config :blunderfest, BlunderfestWeb.Endpoint,
  check_origin: ["//blunderfest.org"],
  cache_static_manifest: "priv/static/cache_manifest.json"

# Do not print debug messages in production
config :logger, level: :info

# Runtime production configuration, including reading
# of environment variables, is done on config/runtime.exs.
