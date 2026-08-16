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
      conn = post(conn, "/api/auth/lichess/start", %{})

      assert %{"url" => url} = json_response(conn, 200)
      assert url =~ "https://lichess.org/oauth?"
      assert url =~ "code_challenge_method=S256"
      assert url =~ "state="
      assert url =~ "scope=study%3Aread"

      assert url =~
               "redirect_uri=#{URI.encode_www_form("http://www.example.com/auth/lichess/callback")}"
    end

    test "with device credentials the flow links to that profile", %{conn: conn} do
      {:ok, profile, secret} = Profiles.create()

      conn =
        conn
        |> put_req_header("authorization", "Bearer #{secret}")
        |> post("/api/auth/lichess/start", %{"profile_id" => profile.id})

      assert %{"url" => url} = json_response(conn, 200)
      [_, state_param] = Regex.run(~r/state=([^&]+)/, url)
      assert {:ok, %{intent: :link, profile_id: got}} = LichessAuth.pop_flow(state_param)
      assert got == profile.id
    end

    test "without credentials the flow recovers", %{conn: conn} do
      conn = post(conn, "/api/auth/lichess/start", %{})

      assert %{"url" => url} = json_response(conn, 200)
      [_, state_param] = Regex.run(~r/state=([^&]+)/, url)
      assert {:ok, %{intent: :recover}} = LichessAuth.pop_flow(state_param)
    end
  end

  describe "GET /auth/lichess/callback" do
    test "a link flow attaches the account and lands home", %{conn: conn} do
      {:ok, profile, _secret} = Profiles.create()
      {state, _verifier} = LichessAuth.begin_flow(:link, profile.id)
      stub_lichess_oauth("dr_ny")

      conn = get(conn, "/auth/lichess/callback", %{"code" => "code-1", "state" => state})

      assert redirected_to(conn) == "/#/?linked=lichess"
      {:ok, updated} = Profiles.get(profile.id)
      assert [%{type: "lichess", username: "dr_ny", token: "tok-123"}] = updated.accounts
    end

    test "a recover flow issues a one-time exchange into device credentials", %{conn: conn} do
      {:ok, profile, _secret} = Profiles.create()

      {:ok, _} =
        Profiles.link_account(profile.id, %{
          type: "lichess",
          username: "dr_ny",
          token: "old-tok",
          scopes: [],
          linked_at: DateTime.utc_now()
        })

      {state, _verifier} = LichessAuth.begin_flow(:recover)
      stub_lichess_oauth("dr_ny")

      conn = get(conn, "/auth/lichess/callback", %{"code" => "code-1", "state" => state})

      ["/#/?exchange=" <> code] = [redirected_to(conn)]

      conn = post(conn, "/api/auth/exchange", %{"code" => code})

      assert %{"profile" => %{"id" => got, "name" => _}, "secret" => new_secret} =
               json_response(conn, 200)

      assert got == profile.id
      assert Profiles.authenticate(profile.id, new_secret)

      # Single use.
      conn = post(conn, "/api/auth/exchange", %{"code" => code})
      assert %{"errors" => %{"code" => "invalid_exchange_code"}} = json_response(conn, 401)
    end

    test "a recover flow for an unlinked account explains itself", %{conn: conn} do
      {state, _verifier} = LichessAuth.begin_flow(:recover)
      stub_lichess_oauth("unknown_user")

      conn = get(conn, "/auth/lichess/callback", %{"code" => "code-1", "state" => state})

      assert redirected_to(conn) == "/#/?auth_error=not_linked"
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
end
