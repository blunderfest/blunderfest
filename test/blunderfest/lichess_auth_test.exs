defmodule Blunderfest.LichessAuthTest do
  use ExUnit.Case, async: false

  alias Blunderfest.LichessAuth

  setup do
    LichessAuth.reset()
    :ok
  end

  test "a flow round-trips intent, profile and verifier, once" do
    {state, verifier} = LichessAuth.begin_flow(:sign_in, "profile-1")

    assert {:ok, flow} = LichessAuth.pop_flow(state)
    assert flow.intent == :sign_in
    assert flow.profile_id == "profile-1"
    assert flow.verifier == verifier

    # Single use.
    assert :error = LichessAuth.pop_flow(state)
  end

  test "flows without a profile id round-trip as nil" do
    {state, _verifier} = LichessAuth.begin_flow(:sign_in, nil)

    assert {:ok, %{intent: :sign_in, profile_id: nil, return_to: nil}} =
             LichessAuth.pop_flow(state)
  end

  test "a flow round-trips its return_to" do
    {state, _verifier} = LichessAuth.begin_flow(:sign_in, "profile-1", "#/r/abc23")

    assert {:ok, %{return_to: "#/r/abc23"}} = LichessAuth.pop_flow(state)
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
