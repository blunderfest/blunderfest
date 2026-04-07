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
      setup: ["deps.get", "cmd --cd apps/blunderfest_web/assets pnpm install"],
      "assets.setup": ["cmd --cd apps/blunderfest_web/assets pnpm install"],
      "assets.dev": ["cmd --cd apps/blunderfest_web/assets pnpm run dev"],
      "assets.build": ["cmd --cd apps/blunderfest_web/assets pnpm run build"],
      "assets.deploy": ["cmd --cd apps/blunderfest_web/assets pnpm run build"]
    ]
  end
end
