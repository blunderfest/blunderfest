import { NextRequest, NextResponse } from "next/server";
import { generateName } from "./lib/identity";

/**
 * Anonymous identity: no accounts, no signup. First request in a browser mints
 * a stable id + a fun display name, stored in a year-long cookie.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const year = 60 * 60 * 24 * 365;

  if (!request.cookies.get("bf_uid")?.value) {
    response.cookies.set("bf_uid", crypto.randomUUID(), {
      maxAge: year,
      sameSite: "lax",
      path: "/",
    });
  }
  if (!request.cookies.get("bf_name")?.value) {
    response.cookies.set("bf_name", encodeURIComponent(generateName()), {
      maxAge: year,
      sameSite: "lax",
      path: "/",
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
