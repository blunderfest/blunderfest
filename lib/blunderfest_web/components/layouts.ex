defmodule BlunderfestWeb.Layouts do
  use BlunderfestWeb, :html

  embed_templates "layouts/*"

  @env Mix.env()

  def dev_env?, do: @env == :dev
end
