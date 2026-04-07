defmodule Blunderfest.Umbrella.MixProject do
  use Mix.Project

  def project do
    [
      apps_path: "apps",
      start_permanent: Mix.env() == :prod,
      aliases: aliases()
    ]
  end

  defp aliases do
    [
      setup: ["deps.get", "cmd --app blunderfest_ui pnpm install"],
      "assets.deploy": ["cmd --app blunderfest_ui pnpm run build"]
    ]
  end
end
