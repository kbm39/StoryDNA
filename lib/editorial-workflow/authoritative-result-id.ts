import "server-only";

export type ReviewId = string & { readonly __brand: "ReviewId" };
export type ParsedReviewHash = string & { readonly __brand: "ParsedReviewHash" };

export const INVALID_AUTHORITATIVE_RESULT_ID = "INVALID_AUTHORITATIVE_RESULT_ID" as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;

export type AuthoritativeResultIdClassification = "uuid" | "sha256_hex" | "invalid";

export interface AuthoritativeResultIdDiagnostics {
  readonly code: typeof INVALID_AUTHORITATIVE_RESULT_ID;
  readonly expected: "uuid";
  readonly received: AuthoritativeResultIdClassification;
  readonly length: number;
  readonly prefix: string;
}

export function classifyAuthoritativeResultIdValue(
  value: string,
): AuthoritativeResultIdClassification {
  if (UUID_PATTERN.test(value)) return "uuid";
  if (SHA256_HEX_PATTERN.test(value)) return "sha256_hex";
  return "invalid";
}

export function buildAuthoritativeResultIdDiagnostics(
  value: string,
): AuthoritativeResultIdDiagnostics {
  return Object.freeze({
    code: INVALID_AUTHORITATIVE_RESULT_ID,
    expected: "uuid",
    received: classifyAuthoritativeResultIdValue(value),
    length: value.length,
    prefix: value.slice(0, 8),
  });
}

export function isInvalidAuthoritativeResultIdError(
  error: unknown,
): error is Error & { diagnostics: AuthoritativeResultIdDiagnostics } {
  return (
    error instanceof Error &&
    error.message === INVALID_AUTHORITATIVE_RESULT_ID &&
    typeof (error as { diagnostics?: unknown }).diagnostics === "object"
  );
}

export function validateAuthoritativeResultId(value: string): ReviewId {
  if (classifyAuthoritativeResultIdValue(value) === "uuid") {
    return value as ReviewId;
  }

  const diagnostics = buildAuthoritativeResultIdDiagnostics(value);
  const error = new Error(INVALID_AUTHORITATIVE_RESULT_ID) as Error & {
    diagnostics: AuthoritativeResultIdDiagnostics;
  };
  error.diagnostics = diagnostics;
  throw error;
}

export function assertParsedReviewHash(value: string): ParsedReviewHash {
  if (!SHA256_HEX_PATTERN.test(value)) {
    throw new Error("INVALID_PARSED_REVIEW_HASH");
  }
  return value as ParsedReviewHash;
}
