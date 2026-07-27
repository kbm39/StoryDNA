import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isStudioFeatureEnabled } from "./feature-flag.ts";

const SESSION_COOKIE = "ms_session";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** True when the app session cookie matches APP_SESSION_SECRET. */
export async function hasAppSession(): Promise<boolean> {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) return true;
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  return safeEqual(token, secret);
}

/**
 * Kevin Track studio gate.
 *
 * Single-tenant app: authenticated session = owner access.
 * No separate user table exists; do not hard-code personal emails.
 */
export async function isStudioAccessAllowed(): Promise<boolean> {
  if (!isStudioFeatureEnabled()) return false;
  return hasAppSession();
}

/** Redirect unauthorized users away from /studio routes. */
export async function requireStudioAccess(nextPath?: string): Promise<void> {
  if (!isStudioFeatureEnabled()) {
    redirect("/?studio=disabled");
  }
  const allowed = await hasAppSession();
  if (!allowed) {
    const login = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login?next=/studio";
    redirect(login);
  }
}
