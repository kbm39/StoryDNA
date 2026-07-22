/**
 * Editor-in-Chief — routing types (Phase 1 façade only).
 */

import type { ExpertCapability } from "@/lib/expert-review-engine/types.ts";

export type SelectionReasonCode =
  | "capability_match"
  | "explicit_expert_key"
  | "default_commercial"
  | "admin_inspection";

export interface SelectionReason {
  code: SelectionReasonCode;
  detail: string;
}

export interface RequestedCapability {
  capability: ExpertCapability;
  required: boolean;
}

export interface ExpertAssignmentRequest {
  manuscriptId?: string;
  manuscriptVersionId?: string;
  /** When set, resolves a specific expert for administrative inspection. */
  explicitExpertKey?: string;
  requestedCapabilities: RequestedCapability[];
  includeDisabled?: boolean;
}

export interface ExpertAssignment {
  expertKey: string;
  expertVersion: string;
  displayName: string;
  matchedCapabilities: ExpertCapability[];
  reasons: SelectionReason[];
}

export interface UnresolvedCapability {
  capability: ExpertCapability;
  reason: string;
}

export interface ExpertAssignmentPlan {
  assignments: ExpertAssignment[];
  unresolved: UnresolvedCapability[];
  /** Phase 1: routing only — never executes reviews. */
  executionPlanned: false;
}
