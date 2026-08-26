defmodule Blunderfest.RoomLog.Store do
  @moduledoc false

  # Raw Postgrex operations for the durable room log. Everything here is
  # best-effort: callers (the RoomLog GenServer) log failures, never raise.
  # JSON columns round-trip through Jason (Postgrex's default json library),
  # and timestamptz columns come back as DateTime — the same representation
  # the in-memory op log already uses, so loaded rooms are indistinguishable.

  require Logger

  @doc "Creates the two tables idempotently."
  @spec ensure_schema(pid()) :: :ok
  def ensure_schema(pool) do
    Postgrex.query!(pool, """
    CREATE TABLE IF NOT EXISTS room_logs (
      slug text PRIMARY KEY,
      roles jsonb NOT NULL DEFAULT '{}'::jsonb,
      last_active_at timestamptz NOT NULL DEFAULT now()
    )
    """)

    Postgrex.query!(pool, """
    CREATE TABLE IF NOT EXISTS room_ops (
      slug text NOT NULL REFERENCES room_logs(slug) ON DELETE CASCADE,
      seq integer NOT NULL,
      type text NOT NULL,
      payload jsonb NOT NULL,
      author text NOT NULL,
      author_name text,
      ts timestamptz NOT NULL,
      PRIMARY KEY (slug, seq)
    )
    """)
  rescue
    error ->
      Logger.error("room_log schema init failed: #{inspect(error)}")
  end

  @doc """
  Appends one op and touches the room row. The in-memory log is
  authoritative, so a missing room row is created on the way (roles stay
  untouched when it already exists).
  """
  @spec append(pid(), String.t(), map(), String.t() | nil, pos_integer()) :: :ok
  def append(pool, slug, op, author_name, _max_ops_per_room) do
    # Trusted internal appends (the demo seeder, tests) may not stamp an
    # author or a payload — the durable mirror defaults them.
    author = Map.get(op, "author", "anonymous")
    payload = Map.get(op, "payload", %{})

    Postgrex.query!(
      pool,
      """
      INSERT INTO room_logs (slug, roles, last_active_at)
      VALUES ($1, '{}'::jsonb, $2)
      ON CONFLICT (slug) DO UPDATE
        SET last_active_at = GREATEST(room_logs.last_active_at, EXCLUDED.last_active_at)
      """,
      [slug, op["ts"]]
    )

    Postgrex.query!(
      pool,
      """
      INSERT INTO room_ops (slug, seq, type, payload, author, author_name, ts)
      VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
      ON CONFLICT (slug, seq) DO NOTHING
      """,
      [slug, op["seq"], op["type"], payload, author, author_name, op["ts"]]
    )

    :ok
  rescue
    error ->
      Logger.error("room_log append failed for #{slug}: #{inspect(error)}")
      :ok
  end

  @spec put_roles(pid(), String.t(), map()) :: :ok
  def put_roles(pool, slug, roles) do
    encoded =
      Map.new(roles, fn {profile_id, role} -> {profile_id, Atom.to_string(role)} end)

    # Upsert: a role change may be the room's first durable write (a room
    # with roles but no ops yet still deserves its mirror).
    Postgrex.query!(
      pool,
      """
      INSERT INTO room_logs (slug, roles, last_active_at)
      VALUES ($1, $2::jsonb, $3)
      ON CONFLICT (slug) DO UPDATE
        SET roles = EXCLUDED.roles,
            last_active_at = GREATEST(room_logs.last_active_at, EXCLUDED.last_active_at)
      """,
      [slug, encoded, DateTime.utc_now()]
    )

    :ok
  rescue
    error ->
      Logger.error("room_log put_roles failed for #{slug}: #{inspect(error)}")
      :ok
  end

  @spec load(pid(), String.t()) ::
          {:ok, %{ops: [map()], roles: map(), last_active_at: DateTime.t()}} | :not_found
  def load(pool, slug) do
    room_result =
      Postgrex.query!(
        pool,
        "SELECT roles, last_active_at FROM room_logs WHERE slug = $1",
        [slug]
      )

    if room_result.num_rows == 0 do
      :not_found
    else
      [[roles, last_active_at]] = room_result.rows

      %{rows: op_rows} =
        Postgrex.query!(
          pool,
          """
          SELECT seq, type, payload, author, author_name, ts
          FROM room_ops WHERE slug = $1 ORDER BY seq
          """,
          [slug]
        )

      ops =
        Enum.map(op_rows, fn [seq, type, payload, author, author_name, ts] ->
          op = %{
            "seq" => seq,
            "type" => type,
            "payload" => payload,
            "author" => author,
            "ts" => ts
          }

          if author_name, do: Map.put(op, "author_name", author_name), else: op
        end)

      atom_roles =
        Map.new(roles, fn
          {profile_id, "owner"} -> {profile_id, :owner}
          {profile_id, "collaborator"} -> {profile_id, :collaborator}
          {profile_id, "viewer"} -> {profile_id, :viewer}
        end)

      {:ok, %{ops: ops, roles: atom_roles, last_active_at: last_active_at}}
    end
  rescue
    error ->
      Logger.error("room_log load failed for #{slug}: #{inspect(error)}")
      :not_found
  end

  @spec stale_slugs(pid(), non_neg_integer()) :: {:ok, [String.t()]}
  def stale_slugs(pool, older_than_ms) do
    %{rows: rows} =
      Postgrex.query!(
        pool,
        "SELECT slug FROM room_logs WHERE last_active_at < $1",
        [DateTime.add(DateTime.utc_now(), -older_than_ms, :millisecond)]
      )

    {:ok, Enum.map(rows, fn [slug] -> slug end)}
  rescue
    error ->
      Logger.error("room_log stale_slugs failed: #{inspect(error)}")
      {:ok, []}
  end

  @spec delete(pid(), String.t()) :: :ok
  def delete(pool, slug) do
    Postgrex.query!(pool, "DELETE FROM room_logs WHERE slug = $1", [slug])
    :ok
  rescue
    error ->
      Logger.error("room_log delete failed for #{slug}: #{inspect(error)}")
      :ok
  end
end
