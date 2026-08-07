import { NextResponse } from "next/server";
import { createRoom } from "@/lib/server/rooms";
import { viewerFromRequest } from "@/lib/server/identity";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const viewer = viewerFromRequest(request);
  let title: string | undefined;
  try {
    const body = await request.json();
    title = typeof body?.title === "string" ? body.title : undefined;
  } catch {
    title = undefined;
  }
  const room = await createRoom(viewer, title);
  return NextResponse.json({ code: room.code });
}
