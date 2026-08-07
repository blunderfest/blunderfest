import { NextResponse } from "next/server";
import { lichessGameId, parsePgn, summarize } from "@/lib/pgn";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const input = String(body?.input ?? "").trim();

  if (!input)
    return NextResponse.json(
      { error: "Paste a PGN or a Lichess game URL to preview it." },
      { status: 400 },
    );

  let pgn = input;
  let source = "pgn";

  const looksLikeUrl = /^https?:\/\//i.test(input) || /lichess\.org/i.test(input);
  if (looksLikeUrl) {
    const id = lichessGameId(input);
    if (!id)
      return NextResponse.json(
        {
          error:
            "That does not look like a Lichess game URL. Expected something like https://lichess.org/abcd1234",
        },
        { status: 400 },
      );
    try {
      const response = await fetch(
        `https://lichess.org/game/export/${id}?evals=0&clocks=0&literate=0`,
        { headers: { Accept: "application/x-chess-pgn" }, cache: "no-store" },
      );
      if (!response.ok)
        return NextResponse.json(
          {
            error: `Lichess responded ${response.status}. Check the URL, or paste the PGN directly.`,
            offline: true,
          },
          { status: 502 },
        );
      pgn = await response.text();
      source = "lichess";
    } catch {
      return NextResponse.json(
        {
          error:
            "Could not reach lichess.org from this server. Paste the PGN text instead.",
          offline: true,
        },
        { status: 502 },
      );
    }
  }

  const parsed = parsePgn(pgn);
  if (!parsed.ok || !parsed.game)
    return NextResponse.json({ error: parsed.error ?? "Could not parse that PGN." }, { status: 400 });

  return NextResponse.json({
    ok: true,
    source,
    pgn,
    summary: summarize(parsed.game),
    warnings: parsed.game.errors,
  });
}
