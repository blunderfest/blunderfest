defmodule Blunderfest.Middleware.RateLimit do
  @moduledoc """
  Rate limiting middleware based on API tier.
  """

  import Plug.Conn
  import Phoenix.Controller, only: [json: 2]

  @limits %{
    free: %{requests_per_minute: 60, requests_per_day: 1000},
    basic: %{requests_per_minute: 300, requests_per_day: 10000},
    pro: %{requests_per_minute: 1000, requests_per_day: 100000},
    enterprise: %{requests_per_minute: 5000, requests_per_day: :infinity}
  }

  def init(opts), do: opts

  def call(conn, _opts) do
    tier = conn.assigns[:api_tier] || :free
    limits = Map.get(@limits, tier, @limits[:free])

    bucket_key = "rate_limit:#{tier}:#{minute_bucket()}"

    current = :ets.update_counter(:rate_limit_table, bucket_key, {2, 1}, {bucket_key, 0, 0}, 60_000)

    if current > limits.requests_per_minute do
      conn
      |> put_status(:too_many_requests)
      |> json(%{
        success: false,
        error: %{
          code: "RATE_LIMITED",
          message: "Rate limit exceeded. Please try again later."
        }
      })
      |> halt()
    else
      conn
      |> put_resp_header("X-RateLimit-Limit", "#{limits.requests_per_minute}")
      |> put_resp_header("X-RateLimit-Remaining", "#{limits.requests_per_minute - current}")
    end
  end

  defp minute_bucket do
    System.system_time(:second) |> div(60)
  end
end
