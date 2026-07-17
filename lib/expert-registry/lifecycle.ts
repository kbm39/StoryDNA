/**
 * Expert version lifecycle rules — application-layer validation.
 * Database RPC `activate_expert_version` enforces atomic activation.
 */

export {
  validateExpertDefinition,
  validateExpertScope,
  validateLifecycleTransition,
  evidenceOverrideWeakensBaseline,
  mergedEvidenceMinimums,
} from "./schema.ts";

export type { ExpertDefinitionValidation, ValidationError, ValidationResult } from "./schema.ts";

import { validateLifecycleTransition } from "./schema.ts";
import type { ExpertLifecycleStatus } from "./types.ts";

export function assertLifecycleTransition(
  from: ExpertLifecycleStatus,
  to: ExpertLifecycleStatus,
): void {
  const result = validateLifecycleTransition(from, to);
  if (!result.ok) throw new Error(result.error);
}

export function isImmutableLifecycleStatus(status: ExpertLifecycleStatus): boolean {
  return status === "active" || status === "deprecated" || status === "archived";
}
