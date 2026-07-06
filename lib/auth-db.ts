import "server-only";
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export interface AuthRow {
  password_hash: string | null;
  reset_token_hash: string | null;
  reset_expires_at: string | null;
}

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(pw, salt, 64);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const key = Buffer.from(keyHex, "hex");
  const test = scryptSync(pw, Buffer.from(saltHex, "hex"), 64);
  return key.length === test.length && timingSafeEqual(key, test);
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Read the single auth row. Returns null if the table doesn't exist yet. */
export async function getAuthRow(): Promise<AuthRow | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("app_auth")
      .select("password_hash, reset_token_hash, reset_expires_at")
      .eq("id", 1)
      .maybeSingle();
    if (error) return null;
    return (data as AuthRow) ?? null;
  } catch {
    return null;
  }
}

export async function setResetToken(token: string, expiresAt: Date): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("app_auth")
    .update({
      reset_token_hash: tokenHash(token),
      reset_expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}

/** Validate a reset token against the stored hash + expiry (constant-time). */
export async function isResetTokenValid(token: string): Promise<boolean> {
  const row = await getAuthRow();
  if (!row?.reset_token_hash || !row.reset_expires_at) return false;
  if (new Date(row.reset_expires_at).getTime() < Date.now()) return false;
  const provided = Buffer.from(tokenHash(token));
  const stored = Buffer.from(row.reset_token_hash);
  return provided.length === stored.length && timingSafeEqual(provided, stored);
}

/** Set a new password and clear any outstanding reset token. */
export async function setPassword(pw: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("app_auth")
    .update({
      password_hash: hashPassword(pw),
      reset_token_hash: null,
      reset_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}
