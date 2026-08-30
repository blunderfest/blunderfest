defmodule BlunderfestWeb.AuthControllerTest do
  use BlunderfestWeb.ConnCase

  alias Blunderfest.{LichessAuth, Profiles}

  setup do
    Profiles.reset()
    LichessAuth.reset()
    :ok
  end

  defp stub_lichess_oauth(username) do
    Req.Test.stub(Blunderfest.Lichess, fn conn ->
      case conn.request_path do
        "/api/token" -> Req.Test.json(conn, %{"access_token" => "tok-123"})
        "/api/account" -> Req.Test.json(conn, %{"username" => username})
      end
    end)
  end

  describe "POST /api/auth/lichess/start" do
    test "returns an authorize URL with PKCE parameters", %{conn: conn} do
      {:ok, profile, secret} = Profiles.create()

      conn =
        conn
        |> put_req_header("authorization", "Bearer #{secret}")
        |> post("/api/auth/lichess/start", %{"profile_id" => profile.id})

      assert %{"url" => url} = json_response(conn, 200)
      assert url =~ "https://lichess.org/oauth?"
      assert url =~ "code_challenge_method=S256"
      assert url =~ "state="
      assert url =~ "scope=study%3Aread"

      assert url =~
               "redirect_uri=#{URI.encode_www_form("http://www.example.com/auth/lichess/callback")}"

      [_, state_param] = Regex.run(~r/state=([^&]+)/, url)
      assert {:ok, %{intent: :sign_in, profile_id: got}} = LichessAuth.pop_flow(state_param)
      assert got == profile.id
    end

    test "requires device credentials", %{conn: conn} do
      conn = post(conn, "/api/auth/lichess/start", %{})

      assert %{"errors" => %{"code" => "unauthorized"}} = json_response(conn, 401)
    end

    test "round-trips a validated return_to for the callback", %{conn: conn} do
      {:ok, profile, secret} = Profiles.create()

      conn =
        conn
        |> put_req_header("authorization", "Bearer #{secret}")
        |> post("/api/auth/lichess/start", %{
          "profile_id" => profile.id,
          "return_to" => "#/r/abc23"
        })

      assert %{"url" => url} = json_response(conn, 200)
      [_, state_param] = Regex.run(~r/state=([^&]+)/, url)
      assert {:ok, %{return_to: "#/r/abc23"}} = LichessAuth.pop_flow(state_param)
    end

    test "rejects a return_to that is not a room route", %{conn: conn} do
      {:ok, profile, secret} = Profiles.create()

      for bad <- ["https://evil.example", "/#/r/abc23", "#/r/nope!", "#/search"] do
        conn =
          conn
          |> put_req_header("authorization", "Bearer #{secret}")
          |> post("/api/auth/lichess/start", %{"profile_id" => profile.id, "return_to" => bad})

        assert %{"url" => url} = json_response(conn, 200)
        [_, state_param] = Regex.run(~r/state=([^&]+)/, url)
        assert {:ok, %{return_to: nil}} = LichessAuth.pop_flow(state_param)
      end
    end
  end

  describe "GET /auth/lichess/callback" do
    test "an unknown account binds to the current profile and lands home", %{conn: conn} do
      {:ok, profile, _secret} = Profiles.create()
      {state, _verifier} = LichessAuth.begin_flow(:sign_in, profile.id)
      stub_lichess_oauth("dr_ny")

      conn = get(conn, "/auth/lichess/callback", %{"code" => "code-1", "state" => state})

      assert redirected_to(conn) == "/#/?linked=lichess"
      {:ok, updated} = Profiles.get(profile.id)
      assert [%{type: "lichess", username: "dr_ny", token: "tok-123"}] = updated.accounts
    end

    test "a bind returns to the room the flow started from", %{conn: conn} do
      {:ok, profile, _secret} = Profiles.create()
      {state, _verifier} = LichessAuth.begin_flow(:sign_in, profile.id, "#/r/abc23")
      stub_lichess_oauth("dr_ny")

      conn = get(conn, "/auth/lichess/callback", %{"code" => "code-1", "state" => state})

      assert redirected_to(conn) == "/#/r/abc23?linked=lichess"
      {:ok, updated} = Profiles.get(profile.id)
      assert [%{type: "lichess", username: "dr_ny"}] = updated.accounts
    end

    test "an adoption returns to the room the flow started from", %{conn: conn} do
      {:ok, known, _secret} = Profiles.create()
      {:ok, current, _secret} = Profiles.create()

      {:ok, _} =
        Profiles.link_account(known.id, %{
          type: "lichess",
          username: "dr_ny",
          token: "old-tok",
          scopes: [],
          linked_at: DateTime.utc_now()
        })

      {state, _verifier} = LichessAuth.begin_flow(:sign_in, current.id, "#/r/abc23")
      stub_lichess_oauth("dr_ny")

      conn = get(conn, "/auth/lichess/callback", %{"code" => "code-1", "state" => state})

      ["/#/r/abc23?exchange=" <> code] = [redirected_to(conn)]

      conn = post(conn, "/api/auth/exchange", %{"code" => code})
      assert %{"profile" => %{"id" => got}} = json_response(conn, 200)
      assert got == known.id
    end

    test "a bound account adopts the known profile via a one-time exchange", %{conn: conn} do
      # The use case: signing in from a second browser — the session
      # becomes the known profile (name follows the binding), with a
      # fresh token stored.
      {:ok, known, _secret} = Profiles.create()
      {:ok, current, _secret} = Profiles.create()

      {:ok, _} =
        Profiles.link_account(known.id, %{
          type: "lichess",
          username: "dr_ny",
          token: "old-tok",
          scopes: [],
          linked_at: DateTime.utc_now()
        })

      {state, _verifier} = LichessAuth.begin_flow(:sign_in, current.id)
      stub_lichess_oauth("dr_ny")

      conn = get(conn, "/auth/lichess/callback", %{"code" => "code-1", "state" => state})

      ["/#/?exchange=" <> code] = [redirected_to(conn)]

      conn = post(conn, "/api/auth/exchange", %{"code" => code})

      assert %{"profile" => %{"id" => got}, "secret" => new_secret} = json_response(conn, 200)
      assert got == known.id
      assert Profiles.authenticate(known.id, new_secret)

      {:ok, refreshed} = Profiles.get(known.id)
      assert [%{token: "tok-123"}] = refreshed.accounts

      # The current profile gained no account, and the code is single-use.
      {:ok, current_after} = Profiles.get(current.id)
      assert current_after.accounts == []

      conn = post(conn, "/api/auth/exchange", %{"code" => code})
      assert %{"errors" => %{"code" => "invalid_exchange_code"}} = json_response(conn, 401)
    end

    test "a stale state fails the flow", %{conn: conn} do
      conn = get(conn, "/auth/lichess/callback", %{"code" => "code-1", "state" => "stale"})

      assert redirected_to(conn) == "/#/?auth_error=flow_failed"
    end
  end

  describe "POST /api/auth/exchange" do
    test "requires a code", %{conn: conn} do
      conn = post(conn, "/api/auth/exchange", %{})

      assert %{"errors" => %{"code" => "invalid_request"}} = json_response(conn, 400)
    end
  end

  describe "POST /api/auth/unlink" do
    test "detaches the account, revokes the token, and returns the updated profile", %{
      conn: conn
    } do
      {:ok, profile, secret} = Profiles.create()

      {:ok, _} =
        Profiles.link_account(profile.id, %{
          type: "lichess",
          username: "dr_ny",
          token: "tok-123",
          scopes: ["study:read"],
          linked_at: DateTime.utc_now()
        })

      Req.Test.stub(Blunderfest.Lichess, fn conn ->
        assert conn.method == "DELETE"
        assert conn.request_path == "/api/token"
        Plug.Conn.send_resp(conn, 204, "")
      end)

      conn =
        conn
        |> put_req_header("authorization", "Bearer #{secret}")
        |> post("/api/auth/unlink", %{"profile_id" => profile.id})

      assert %{"profile" => %{"accounts" => []}} = json_response(conn, 200)
      assert {:error, :not_found} = Profiles.profile_by_account("lichess", "dr_ny")
    end

    test "requires device credentials", %{conn: conn} do
      conn = post(conn, "/api/auth/unlink", %{"profile_id" => "nope"})

      assert %{"errors" => %{"code" => "unauthorized"}} = json_response(conn, 401)
    end
  end
end
