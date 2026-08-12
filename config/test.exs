import Config

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :blunderfest, BlunderfestWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "XO7CfbIOuy38/AJ08lWM6CKNrZsHTZxIxolBxmw55gKONcy903+oHJUq7ANuuaan",
  server: false

# Print only warnings and errors during test
config :logger, level: :warning

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime

# Sort query params output of verified routes for robust url comparisons
config :phoenix,
  sort_verified_routes_query_params: true

# Run Lichess requests through Req.Test stubs instead of the network
config :blunderfest, lichess_req_options: [plug: {Req.Test, Blunderfest.Lichess}]

# The engine pool runs the canned UCI fixture, not a real Stockfish
config :blunderfest, Blunderfest.Engine.Pool,
  binary: Path.expand("../test/support/fake_uci_engine.sh", __DIR__)
