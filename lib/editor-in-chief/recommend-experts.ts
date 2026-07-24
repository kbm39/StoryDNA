/**
 * Editor-in-Chief — minimal routing façade (Phase 1).
 *
 * Resolves experts via in-code registry capability lookup.
 * No workflows, DB writes, or AI selection.
 */

import {
  getExpertRuntimeDefinition,
  resolveExpertsByCapability,
} from "@/lib/expert-review-engine/registry/in-code.ts";
import { EXPERT_RELATIONSHIP_KEY_PATTERN } from "@/lib/expert-review-engine/expert-relationships.ts";
import type { ExpertCapability } from "@/lib/expert-review-engine/types.ts";
import type {
  ExpertAssignment,
  ExpertAssignmentPlan,
  ExpertAssignmentRequest,
  RequestedCapability,
  SelectionReason,
  UnresolvedCapability,
  UnresolvedExpert,
} from "./types.ts";

function reason(code: SelectionReason["code"], detail: string): SelectionReason {
  return { code, detail };
}

function compareReasons(a: SelectionReason, b: SelectionReason): number {
  return a.code.localeCompare(b.code) || a.detail.localeCompare(b.detail);
}

function compareCapabilities(a: ExpertCapability, b: ExpertCapability): number {
  return a.localeCompare(b);
}

interface AssignmentBuilder {
  expertKey: string;
  expertVersion: string;
  displayName: string;
  matchedCapabilities: Set<ExpertCapability>;
  reasons: SelectionReason[];
  explicitlyRequested: boolean;
}

function dedupeRequestedCapabilities(
  requested: RequestedCapability[],
): RequestedCapability[] {
  const byCapability = new Map<ExpertCapability, RequestedCapability>();
  for (const req of requested) {
    const existing = byCapability.get(req.capability);
    if (!existing) {
      byCapability.set(req.capability, req);
      continue;
    }
    if (req.required && !existing.required) {
      byCapability.set(req.capability, { ...existing, required: true });
    }
  }
  return [...byCapability.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, req]) => req);
}

function upsertAssignment(
  builders: Map<string, AssignmentBuilder>,
  entry: {
    expertKey: string;
    expertVersion: string;
    displayName: string;
    capability?: ExpertCapability;
    selectionReason: SelectionReason;
    explicitlyRequested?: boolean;
  },
): void {
  const existing = builders.get(entry.expertKey);
  if (!existing) {
    builders.set(entry.expertKey, {
      expertKey: entry.expertKey,
      expertVersion: entry.expertVersion,
      displayName: entry.displayName,
      matchedCapabilities: entry.capability ? new Set([entry.capability]) : new Set(),
      reasons: [entry.selectionReason],
      explicitlyRequested: entry.explicitlyRequested ?? false,
    });
    return;
  }

  if (entry.explicitlyRequested) {
    existing.explicitlyRequested = true;
  }
  if (entry.capability) {
    existing.matchedCapabilities.add(entry.capability);
  }
  if (!existing.reasons.some((r) => r.code === entry.selectionReason.code && r.detail === entry.selectionReason.detail)) {
    existing.reasons.push(entry.selectionReason);
  }
}

function finalizeAssignments(builders: Map<string, AssignmentBuilder>): ExpertAssignment[] {
  return [...builders.values()]
    .sort((a, b) => a.expertKey.localeCompare(b.expertKey))
    .map((builder) => ({
      expertKey: builder.expertKey,
      expertVersion: builder.expertVersion,
      displayName: builder.displayName,
      matchedCapabilities: [...builder.matchedCapabilities].sort(compareCapabilities),
      reasons: [...builder.reasons].sort(compareReasons),
    }));
}

export function recommendExperts(request: ExpertAssignmentRequest): ExpertAssignmentPlan {
  const includeDisabled = request.includeDisabled ?? false;
  const builders = new Map<string, AssignmentBuilder>();
  const unresolved: UnresolvedCapability[] = [];
  const unresolvedExperts: UnresolvedExpert[] = [];

  if (request.explicitExpertKey !== undefined) {
    const explicitKey = request.explicitExpertKey;
    if (!explicitKey.trim() || !EXPERT_RELATIONSHIP_KEY_PATTERN.test(explicitKey)) {
      unresolvedExperts.push({
        expertKey: explicitKey,
        reason: "malformed_explicit_expert_key",
      });
    } else {
      const entry = getExpertRuntimeDefinition(explicitKey, { includeDisabled });
      if (!entry) {
        unresolvedExperts.push({
          expertKey: explicitKey,
          reason: "unknown_explicit_expert",
        });
      } else {
        upsertAssignment(builders, {
          expertKey: entry.definition.expert_key,
          expertVersion: entry.definition.expert_version,
          displayName: entry.definition.display_name,
          selectionReason: reason(
            "explicit_expert_key",
            `Explicit request for ${explicitKey}`,
          ),
          explicitlyRequested: true,
        });
      }
    }
  }

  for (const req of dedupeRequestedCapabilities(request.requestedCapabilities)) {
    const matches = resolveExpertsByCapability(req.capability, { includeDisabled });

    if (matches.length === 0) {
      if (req.required) {
        unresolved.push({
          capability: req.capability,
          reason: "no_registered_expert_for_capability",
        });
      }
      continue;
    }

    const best = [...matches].sort(
      (a, b) =>
        b.definition.priority.base - a.definition.priority.base ||
        a.definition.expert_key.localeCompare(b.definition.expert_key),
    )[0]!;

    upsertAssignment(builders, {
      expertKey: best.definition.expert_key,
      expertVersion: best.definition.expert_version,
      displayName: best.definition.display_name,
      capability: req.capability,
      selectionReason: reason(
        "capability_match",
        `Matched capability ${req.capability} via registry lookup`,
      ),
    });
  }

  return {
    assignments: finalizeAssignments(builders),
    unresolved,
    unresolvedExperts,
    executionPlanned: false,
  };
}

/** Convenience: commercial Literary Agent review routing. */
export function recommendCommercialLiteraryAgent(): ExpertAssignmentPlan {
  return recommendExperts({
    requestedCapabilities: [{ capability: "commercial_analysis", required: true }],
  });
}

export function findExpertForCapability(
  capability: ExpertCapability,
  options?: { includeDisabled?: boolean },
): ExpertAssignment | null {
  const plan = recommendExperts({
    requestedCapabilities: [{ capability, required: true }],
    includeDisabled: options?.includeDisabled,
  });
  return plan.assignments[0] ?? null;
}
