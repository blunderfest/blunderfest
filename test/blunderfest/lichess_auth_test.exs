defmodule Blunderfest.LichessAuthTest do
  use ExUnit.Case, async: false

  alias Blunderfest.LichessAuth

  setup do
    LichessAuth.reset()
    :ok
  end

  test "a flow round-trips intent, profile and verifier, once" do
    {state, verifier} = LichessAuth.begin_flow(:link, "profile-1")

    assert {:ok, flow} = LichessAuth.pop_flow(state)
    assert flow.intent == :link
    assert flow.profile_id == "profile-1"
    assert flow.verifier == verifier

    # Single use.
    assert :error = LichessAuth.pop_flow(state)
  end

  test "recover flows carry no profile id" do
    {state, _verifier} = LichessAuth.begin_flow(:recover)
    assert {:ok, %{intent: :recover, profile_id: nil}} = LichessAuth.pop_flow(state)
  end

  test "unknown state params are rejected" do
    assert :error = LichessAuth.pop_flow("nope")
  end

  test "an exchange code yields its profile id, once" do
    code = LichessAuth.issue_exchange_code("profile-1")

    assert {:ok, "profile-1"} = LichessAuth.pop_exchange_code(code)
    assert :error = LichessAuth.pop_exchange_code(code)
    assert :error = LichessAuth.pop_exchange_code("nope")
  end
end
