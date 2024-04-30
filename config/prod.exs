import Config

# Do not print debug messages in production
config :logger, level: :info

# Runtime production configuration, including reading
# of environment variables, is done on config/runtime.exs.

config :cors_plug,
  origin: ["https://www.blunderfest.org", "https://blunderfest.org"],
  max_age: 86400,
  methods: ["GET", "POST"]
