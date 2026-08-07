import { NextResponse } from "next/server";
import { getRoomState } from "@/lib/server/rooms";
import { viewerFromRequest } from "@/lib/server/identity";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const viewer = viewerFromRequest(request);
  const url = new URL(request.url);
  const join = url.searchParams.get("join") !== "0";
  const state = await getRoomState(code, viewer, { join });
  if (!state) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(state, {
    headers: { "cache-control": "no-store" },
  });
}
