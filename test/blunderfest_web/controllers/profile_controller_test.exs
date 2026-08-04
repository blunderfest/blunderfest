defmodule BlunderfestWeb.ProfileControllerTest do
  use BlunderfestWeb.ConnCase, async: false

  alias Blunderfest.Profiles

  setup do
    Profiles.reset()
    :ok
  end

  describe "POST /api/profiles" do
    test "creates a profile and returns the secret once", %{conn: conn} do
      conn = post(conn, "/api/profiles")

      assert %{
               "profile" => %{"id" => id, "name" => name, "created_at" => _},
               "secret" => secret
             } = json_response(conn, 201)

      assert id != ""
      assert secret != ""
      assert name =~ ~r/^[A-Z][a-z]+ [A-Z][a-z]+ \d{2}$/
      assert Profiles.authenticate(id, secret)
    end
  end

  describe "GET /api/profiles/:id" do
    test "returns the profile with a valid bearer secret", %{conn: conn} do
      {:ok, profile, secret} = Profiles.create()

      conn =
        conn
        |> put_req_header("authorization", "Bearer " <> secret)
        |> get("/api/profiles/#{profile.id}")

      assert %{
               "profile" => %{"id" => id, "name" => name, "created_at" => _}
             } = json_response(conn, 200)

      assert id == profile.id
      assert name == profile.name
      refute Map.has_key?(json_response(conn, 200)["profile"], "secret")
    end

    test "rejects a missing authorization header", %{conn: conn} do
      {:ok, profile, _secret} = Profiles.create()

      conn = get(conn, "/api/profiles/#{profile.id}")

      assert %{"errors" => %{"code" => "unauthorized"}} = json_response(conn, 401)
    end

    test "rejects a wrong secret", %{conn: conn} do
      {:ok, profile, _secret} = Profiles.create()

      conn =
        conn
        |> put_req_header("authorization", "Bearer wrong")
        |> get("/api/profiles/#{profile.id}")

      assert %{"errors" => %{"code" => "unauthorized"}} = json_response(conn, 401)
    end

    test "rejects a valid secret for a different profile", %{conn: conn} do
      {:ok, _profile, secret} = Profiles.create()
      {:ok, other, _other_secret} = Profiles.create()

      conn =
        conn
        |> put_req_header("authorization", "Bearer " <> secret)
        |> get("/api/profiles/#{other.id}")

      assert %{"errors" => %{"code" => "unauthorized"}} = json_response(conn, 401)
    end
  end
end
