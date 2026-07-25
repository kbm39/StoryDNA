/** Anthropic API key presence check — never logs key material. */

export const ANTHROPIC_API_KEY_ENV = "ANTHROPIC_API_KEY" as const;

export function readAnthropicApiKey(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  const value = env[ANTHROPIC_API_KEY_ENV];
  if (value === undefined || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

export function hasAnthropicApiKey(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return readAnthropicApiKey(env) !== null;
}
