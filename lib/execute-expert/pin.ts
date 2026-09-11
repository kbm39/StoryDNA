import type { ExecuteExpertRequest, PinnedManuscriptIdentity } from "./types.ts";

export function assertVersionPin(
  request: ExecuteExpertRequest,
  pinned?: PinnedManuscriptIdentity,
): void {
  const expected = pinned ?? {
    manuscript_id: request.manuscript_id,
    manuscript_version_id: request.manuscript_version_id,
    content_hash: request.content_hash,
  };
  if (
    request.manuscript_id !== expected.manuscript_id ||
    request.manuscript_version_id !== expected.manuscript_version_id ||
    request.content_hash !== expected.content_hash
  ) {
    const error = new Error("VERSION_PIN_MISMATCH");
    error.name = "VersionPinMismatchError";
    throw error;
  }
}

export function isValidContentHash(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}
