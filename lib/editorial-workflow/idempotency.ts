import { randomUUID } from "node:crypto";

/** New unique key per deliberate workflow start attempt. */
export function newWorkflowIdempotencyKey(): string {
  return randomUUID();
}

/** Postgres unique-violation code for active-workflow dedup. */
export const PG_UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === PG_UNIQUE_VIOLATION
  );
}
