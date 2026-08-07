import { cookies } from "next/headers";
import { generateName } from "@/lib/identity";

export interface Viewer {
  id: string;
  name: string;
}

/** Reads the anonymous identity minted by middleware (with a safe fallback). */
export async function getViewer(): Promise<Viewer> {
  const jar = await cookies();
  const id = jar.get("bf_uid")?.value ?? "anon-fallback";
  const raw = jar.get("bf_name")?.value;
  const name = raw ? decodeURIComponent(raw) : generateName();
  return { id, name };
}

export function viewerFromRequest(request: Request): Viewer {
  const header = request.headers.get("cookie") ?? "";
  const map = new Map(
    header
      .split(";")
      .map((part) => part.trim().split("="))
      .filter((kv) => kv.length === 2)
      .map(([k, v]) => [k, v] as [string, string]),
  );
  const id = map.get("bf_uid") ?? "anon-fallback";
  const rawName = map.get("bf_name");
  return {
    id,
    name: rawName ? decodeURIComponent(rawName) : "Anonymous Guest",
  };
}
