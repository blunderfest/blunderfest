defmodule BlunderfestWeb.ApiController do
  use BlunderfestWeb, :controller

  def index(conn, _params), do: json(conn, %{data: "blunder"})
end
