import Config

config :blunderfest, Blunderfest.Repo,
  pool_size: String.to_integer(System.get_env("POOL_SIZE") || "10"),
  ssl: true,
  ssl_opts: [
    verify: :verify_peer,
    cacerts: :public_key.cacerts_get(),
    server_name_indication: ~c"blunderfest.com",
    customize_hostname_check: [
      match_fun: :public_key.pkix_verify_hostname_match_fun(:https)
    ]
  ]

config :blunderfest, BlunderfestWeb.Endpoint,
  url: [host: System.get_env("PHX_HOST") || "blunderfest.com", port: 443],
  force_ssl: [rewrite_on: [:x_forwarded_proto]],
  secret_key_base: System.get_env("SECRET_KEY_BASE")

config :blunderfest, Blunderfest.Storage,
  hot_storage_path: System.get_env("HOT_STORAGE_PATH", "/var/lib/blunderfest/hot"),
  cold_storage_path: System.get_env("COLD_STORAGE_PATH", "s3://blunderfest-cold"),
  cache_size: System.get_env("CACHE_SIZE", "8000000000") |> String.to_integer()

config :logger, level: :info

config :phoenix, :serve_endpoints, true

config :phoenix, :plug_init_mode, :runtime
