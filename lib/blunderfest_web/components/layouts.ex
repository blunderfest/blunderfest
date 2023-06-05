defmodule BlunderfestWeb.Layouts do
  use BlunderfestWeb, :html

  embed_templates "layouts/*"

  def dev_env?, do: Mix.env() == :dev
end
