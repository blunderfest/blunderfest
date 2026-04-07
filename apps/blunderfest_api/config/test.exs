import Config

# Configure your Mix test suite here
config :blunderfest_api, BlunderfestApi.Test.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 8082],
  secret_key_base: "test_secret_key_base_at_least_64_chars_long_for_testing_only_1234",
  server: false

# Print only warnings and errors during test
config :logger, level: :warning

# Initialize gettext on boot for tests
config :blunderfest_api, BlunderfestApi.Gettext, null_parent_locale: "en"
