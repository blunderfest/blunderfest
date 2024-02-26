defmodule BlunderfestWeb.Layouts do
  use BlunderfestWeb, :html

  embed_templates "layouts/*"

  @dialyzer {:nowarn_function, {:dev_env?, 0}}

  # remember value at compile time
  @env Mix.env()
  def dev_env?, do: @env == :dev
end
