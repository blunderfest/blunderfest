defmodule BlunderfestWeb.ChannelCase do
  @moduledoc """
  This module defines the test case to be used by
  channel tests.
  """

  use ExUnit.CaseTemplate

  using do
    quote do
      # The default endpoint for testing
      @endpoint BlunderfestWeb.Endpoint

      import Phoenix.ChannelTest

      import BlunderfestWeb.ChannelCase
    end
  end
end
