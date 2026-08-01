import {
  EDITORIAL_PROFILE_STATUSES,
  type EditorialProfileStatus,
} from "./contract.ts";

/** Valid status transitions — PRD Section 9. */
export const EDITORIAL_PROFILE_TRANSITIONS: Record<
  EditorialProfileStatus,
  readonly EditorialProfileStatus[]
> = {
  not_started: ["awaiting_independent_read", "blocked"],
  awaiting_independent_read: ["generating", "blocked"],
  generating: ["draft", "incomplete_evidence", "failed"],
  incomplete_evidence: ["generating", "draft", "blocked"],
  draft: ["awaiting_eic_confirmation", "generating", "failed"],
  awaiting_eic_confirmation: ["active", "draft", "failed"],
  active: ["updated", "superseded", "blocked"],
  updated: ["active", "superseded"],
  superseded: [],
  blocked: ["draft", "generating", "superseded"],
  failed: ["generating"],
};

export const TERMINAL_EDITORIAL_PROFILE_STATUSES: readonly EditorialProfileStatus[] = Object.freeze([
  "superseded",
]);

export function isValidEditorialProfileStatus(value: string): value is EditorialProfileStatus {
  return (EDITORIAL_PROFILE_STATUSES as readonly string[]).includes(value);
}

export function isTerminalEditorialProfileStatus(status: EditorialProfileStatus): boolean {
  return TERMINAL_EDITORIAL_PROFILE_STATUSES.includes(status);
}

export function getAllowedTransitions(
  from: EditorialProfileStatus,
): readonly EditorialProfileStatus[] {
  return EDITORIAL_PROFILE_TRANSITIONS[from] ?? [];
}

export function canTransitionEditorialProfileStatus(
  from: EditorialProfileStatus,
  to: EditorialProfileStatus,
): boolean {
  if (from === to) return true;
  return getAllowedTransitions(from).includes(to);
}

export type StatusTransitionValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

export function validateEditorialProfileStatusTransition(
  from: EditorialProfileStatus,
  to: EditorialProfileStatus,
): StatusTransitionValidationResult {
  if (from === to) return { ok: true };
  if (isTerminalEditorialProfileStatus(from)) {
    return {
      ok: false,
      reason: `Cannot transition from terminal status "${from}".`,
    };
  }
  if (!canTransitionEditorialProfileStatus(from, to)) {
    return {
      ok: false,
      reason: `Invalid transition from "${from}" to "${to}". Allowed: ${getAllowedTransitions(from).join(", ") || "none"}.`,
    };
  }
  return { ok: true };
}

/** Statuses that require EIC confirmation before author exposure. */
export const PRE_AUTHOR_EXPOSURE_STATUSES: readonly EditorialProfileStatus[] = Object.freeze([
  "not_started",
  "awaiting_independent_read",
  "generating",
  "incomplete_evidence",
  "draft",
  "awaiting_eic_confirmation",
  "failed",
]);

export function isAuthorExposedStatus(status: EditorialProfileStatus): boolean {
  return !PRE_AUTHOR_EXPOSURE_STATUSES.includes(status);
}

/** Only these transitions may reach active — guarded further by activation validation. */
export const ACTIVATION_SOURCE_STATUSES: readonly EditorialProfileStatus[] = Object.freeze([
  "awaiting_eic_confirmation",
]);

export function canAttemptActivation(from: EditorialProfileStatus): boolean {
  return ACTIVATION_SOURCE_STATUSES.includes(from);
}

export function validateActivationTransition(
  from: EditorialProfileStatus,
  to: EditorialProfileStatus,
): StatusTransitionValidationResult {
  if (to !== "active") {
    return validateEditorialProfileStatusTransition(from, to);
  }
  if (!canAttemptActivation(from)) {
    return {
      ok: false,
      reason: `Profile cannot activate from "${from}" — EIC confirmation required (awaiting_eic_confirmation).`,
    };
  }
  return validateEditorialProfileStatusTransition(from, to);
}

/** Blocked status overlay for author disputes. */
export function isDisputeBlockedStatus(
  status: EditorialProfileStatus,
  hasDisputeMetadata: boolean,
): boolean {
  return status === "blocked" && hasDisputeMetadata;
}
