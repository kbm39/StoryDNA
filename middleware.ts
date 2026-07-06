import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE = "ms_session";

/** Constant-time string compare (avoids timing leaks). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function middleware(req: NextRequest) {
  const secret = process.env.APP_SESSION_SECRET;

  // Auth is OPT-IN: with no APP_SESSION_SECRET set (e.g. local dev) the app is
  // open. Set APP_SESSION_SECRET + APP_PASSWORD on your host to lock it down.
  if (!secret) return NextResponse.next();

  const token = req.cookies.get(COOKIE)?.value ?? "";
  if (safeEqual(token, secret)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

// Protect everything except the login page, Next internals, and static files.
export const config = {
  matcher: ["/((?!login|forgot|reset|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
