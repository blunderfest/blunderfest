defmodule BlunderfestWeb.Layouts do
  use BlunderfestWeb, :html

  embed_templates "layouts/*"

  # remember value at compile time
  @env Mix.env()
  def dev_env?, do: @env == :dev
end
