defmodule BlunderfestWeb.PageController do
  use BlunderfestWeb, :controller

  def home(conn, _params) do
    render(conn, :home)
  end

  def design_system(conn, _params) do
    render(conn, :design_system)
  end
end
