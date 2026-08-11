defmodule BlunderfestWeb do
  @moduledoc """
  The entrypoint for defining the web interface: controllers and channels.

      use BlunderfestWeb, :controller
      use BlunderfestWeb, :channel
  """

  def static_paths,
    do: ~w(assets engine fonts images favicon.png favicon.ico robots.txt openings.json)

  def router do
    quote do
      use Phoenix.Router, helpers: false

      # Import common connection and controller functions to use in pipelines
      import Plug.Conn
      import Phoenix.Controller
    end
  end

  def channel do
    quote do
      use Phoenix.Channel
    end
  end

  def controller do
    quote do
      use Phoenix.Controller, formats: [:json]

      import Plug.Conn

      unquote(verified_routes())
    end
  end

  def verified_routes do
    quote do
      use Phoenix.VerifiedRoutes,
        endpoint: BlunderfestWeb.Endpoint,
        router: BlunderfestWeb.Router,
        statics: BlunderfestWeb.static_paths()
    end
  end

  @doc """
  When used, dispatch to the appropriate controller/etc.
  """
  defmacro __using__(which) when is_atom(which) do
    apply(__MODULE__, which, [])
  end
end
