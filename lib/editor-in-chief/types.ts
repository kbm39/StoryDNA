/**
 * Editor-in-Chief — routing types (Phase 1 façade only).
 */

import type { ExpertCapability } from "@/lib/expert-review-engine/types.ts";

export type SelectionReasonCode =
  | "capability_match"
  | "explicit_expert_key"
  | "default_commercial"
  | "admin_inspection";

export type UnresolvedExpertReason =
  | "unknown_explicit_expert"
  | "malformed_explicit_expert_key";

export type UnresolvedCapabilityReason =
  | "no_registered_expert_for_capability"
  | "relationship_not_registered";

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

export interface UnresolvedExpert {
  expertKey: string;
  reason: UnresolvedExpertReason;
}

export interface UnresolvedCapability {
  capability: ExpertCapability;
  reason: UnresolvedCapabilityReason;
}

export interface ExpertAssignmentPlan {
  assignments: ExpertAssignment[];
  unresolved: UnresolvedCapability[];
  unresolvedExperts: UnresolvedExpert[];
  /** Phase 1: routing only — never executes reviews. */
  executionPlanned: false;
}
