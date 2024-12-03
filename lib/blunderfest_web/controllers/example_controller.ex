defmodule BlunderfestWeb.ExampleController do
  use BlunderfestWeb, :controller

  # Action to handle GET requests to "/api/example"
  def index(conn, _params) do
    data = %{
      message: "Hello, world!",
      status: "success"
    }

    conn
    |> put_status(:ok)
    |> json(data)
  end

  # Action to handle POST requests to "/api/example"
  def create(conn, %{"name" => name}) do
    data = %{
      message: "Hello, #{name}!",
      status: "success"
    }

    conn
    |> put_status(:created)
    |> json(data)
  end
end
