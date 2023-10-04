defmodule BlunderfestWeb.Layouts do
  use BlunderfestWeb, :html

  embed_templates "layouts/*"

  @env Mix.env()

  @dialyzer {:nowarn_function, {:dev_env?, 0}}

  def dev_env?, do: @env == :dev
end
