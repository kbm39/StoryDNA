"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import {
  getAuthRow,
  verifyPassword,
  setResetToken,
  isResetTokenValid,
  setPassword,
} from "@/lib/auth-db";
import { sendResetEmail } from "@/lib/email";

const COOKIE = "ms_session";

export interface LoginState {
  error?: string;
}
export interface ResetRequestState {
  ok?: boolean;
  error?: string;
  message?: string;
}
export interface ResetState {
  error?: string;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function safeNext(next: unknown): string {
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

async function originFromRequest(): Promise<string> {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get("password");
  const next = safeNext(formData.get("next"));

  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) {
    return { error: "Login isn’t configured. Set APP_SESSION_SECRET on the server." };
  }
  if (typeof password !== "string") return { error: "Incorrect password." };

  // Prefer the database password (resettable); fall back to the env password.
  const row = await getAuthRow();
  let ok = false;
  if (row?.password_hash) {
    ok = verifyPassword(password, row.password_hash);
  } else if (process.env.APP_PASSWORD) {
    ok = safeEqual(password, process.env.APP_PASSWORD);
  } else {
    return { error: "Login isn’t configured (no password set)." };
  }
  if (!ok) return { error: "Incorrect password." };

  const store = await cookies();
  store.set(COOKIE, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect(next);
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
  redirect("/login");
}

/** "Forgot password" — email a one-time reset link to the configured address. */
export async function requestReset(
  _prev: ResetRequestState,
  _formData: FormData,
): Promise<ResetRequestState> {
  const email = process.env.RESET_EMAIL;
  if (!email) {
    return { error: "Password reset isn’t set up (no RESET_EMAIL configured)." };
  }

  const token = randomBytes(32).toString("hex");
  try {
    await setResetToken(token, new Date(Date.now() + 60 * 60 * 1000));
    const link = `${await originFromRequest()}/reset?token=${token}`;
    await sendResetEmail(email, link);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not send the reset email." };
  }

  return { ok: true, message: "A reset link has been emailed to you. It expires in 1 hour." };
}

/** Set a new password from a valid reset token. */
export async function resetPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const pw = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (pw.length < 6) return { error: "Password must be at least 6 characters." };
  if (pw !== confirm) return { error: "Passwords don’t match." };
  if (!(await isResetTokenValid(token))) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  await setPassword(pw);
  redirect("/login?reset=1");
}
