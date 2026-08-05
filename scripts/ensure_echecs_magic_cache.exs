# Ensures the echecs magic bitboard cache exists before the dependency is
# compiled. The echecs hex package does not ship deps/echecs/priv/magic_cache.bin,
# and Echecs.Bitboard.Magic reads it at compile time. The cache regenerates
# whenever deps are fetched fresh (CI, Docker builder, first local clone).
root = File.cwd!()
cache = Path.join([root, "deps", "echecs", "priv", "magic_cache.bin"])

if File.exists?(cache) do
  IO.puts("echecs magic cache present at #{cache}")
else
  IO.puts("generating echecs magic cache (one-time, ~90s)...")

  {output, status} =
    System.cmd("elixir", ["deps/echecs/scripts/generate_magic_cache.exs"],
      cd: root,
      stderr_to_stdout: true
    )

  IO.write(output)

  unless status == 0 do
    raise "failed to generate the echecs magic cache"
  end
end
