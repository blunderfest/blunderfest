defmodule Blunderfest.RateLimitTest do
  use ExUnit.Case, async: true

  alias Blunderfest.RateLimit

  setup do
    limiter = start_supervised!({RateLimit, limit: 3, window_ms: 1_000, name: nil})
    %{limiter: limiter}
  end

  test "allows up to the limit, then denies", %{limiter: limiter} do
    assert RateLimit.hit("1.2.3.4", limiter) == :allow
    assert RateLimit.hit("1.2.3.4", limiter) == :allow
    assert RateLimit.hit("1.2.3.4", limiter) == :allow
    assert RateLimit.hit("1.2.3.4", limiter) == :deny
    assert RateLimit.hit("1.2.3.4", limiter) == :deny
  end

  test "windows are per key", %{limiter: limiter} do
    for _ <- 1..3, do: RateLimit.hit("1.1.1.1", limiter)

    assert RateLimit.hit("1.1.1.1", limiter) == :deny
    assert RateLimit.hit("2.2.2.2", limiter) == :allow
  end

  test "a new window starts once the old one expires", %{limiter: limiter} do
    assert RateLimit.hit_at("1.2.3.4", 1_000, limiter) == :allow
    assert RateLimit.hit_at("1.2.3.4", 1_000, limiter) == :allow
    assert RateLimit.hit_at("1.2.3.4", 1_000, limiter) == :allow
    assert RateLimit.hit_at("1.2.3.4", 1_500, limiter) == :deny

    # 1_000 ms window: at t=2_000 the first window has expired.
    assert RateLimit.hit_at("1.2.3.4", 2_000, limiter) == :allow
  end

  test "reset clears all windows", %{limiter: limiter} do
    for _ <- 1..3, do: RateLimit.hit("1.2.3.4", limiter)
    assert RateLimit.hit("1.2.3.4", limiter) == :deny

    RateLimit.reset(limiter)
    assert RateLimit.hit("1.2.3.4", limiter) == :allow
  end
end
