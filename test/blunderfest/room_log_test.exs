defmodule Blunderfest.RoomLogTest do
  use ExUnit.Case, async: false

  # The durable room log (ADR-0028), against the local docker Postgres
  # (docs/operations.md) like the corpus tests. Async false: these tests
  # share the global store; unique slugs keep them collision-free.

  alias Blunderfest.RoomLog

  defp slug(tag), do: "tlog#{System.unique_integer([:positive])}-#{tag}"

  defp stamped_op(text) do
    %{
      "seq" => 1,
      "type" => "chat",
      "payload" => %{"text" => text},
      "author" => "profile-1",
      "ts" => DateTime.utc_now()
    }
  end

  defp wait_until(fun, attempts \\ 100)

  defp wait_until(_fun, 0), do: flunk("timed out waiting for the durable write")

  defp wait_until(fun, attempts) do
    if fun.() do
      :ok
    else
      Process.sleep(10)
      wait_until(fun, attempts - 1)
    end
  end

  setup do
    on_exit(fn ->
      _ = :sys.get_state(RoomLog)
    end)

    :ok
  end

  test "appends ops and loads them back with the author-name snapshot", %{} do
    s = slug("roundtrip")

    RoomLog.append(s, stamped_op("hello"), "Brave Otter 42")

    wait_until(fn -> match?({:ok, %{ops: [%{} | _]}}, RoomLog.load(s)) end)

    assert {:ok, %{ops: [op], roles: %{}, last_active_at: last_active_at}} = RoomLog.load(s)
    assert op["seq"] == 1
    assert op["type"] == "chat"
    assert op["payload"] == %{"text" => "hello"}
    assert op["author"] == "profile-1"
    assert op["author_name"] == "Brave Otter 42"
    assert is_struct(last_active_at, DateTime)
  end

  test "load is :not_found for unknown slugs", %{} do
    assert :not_found = RoomLog.load("never-created-slug")
  end

  test "put_roles round-trips atom roles", %{} do
    s = slug("roles")
    RoomLog.append(s, stamped_op("hi"), nil)
    wait_until(fn -> match?({:ok, _}, RoomLog.load(s)) end)

    RoomLog.put_roles(s, %{"profile-1" => :owner, "profile-2" => :collaborator})

    wait_until(fn ->
      match?({:ok, %{roles: %{"profile-1" => :owner}}}, RoomLog.load(s))
    end)

    assert {:ok, %{roles: roles}} = RoomLog.load(s)
    assert roles == %{"profile-1" => :owner, "profile-2" => :collaborator}
  end

  test "delete purges the room's rows", %{} do
    s = slug("delete")
    RoomLog.append(s, stamped_op("bye"), nil)
    wait_until(fn -> match?({:ok, _}, RoomLog.load(s)) end)

    RoomLog.delete(s)
    wait_until(fn -> RoomLog.load(s) == :not_found end)
  end

  test "stale_slugs reports rows older than the threshold", %{} do
    s = slug("stale")
    RoomLog.append(s, stamped_op("old"), nil)
    wait_until(fn -> match?({:ok, _}, RoomLog.load(s)) end)

    {:ok, recent} = RoomLog.stale_slugs(:timer.hours(1))
    refute s in recent

    Process.sleep(5)
    {:ok, stale} = RoomLog.stale_slugs(0)
    assert s in stale
  end
end
