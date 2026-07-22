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
import type { ExpertCapability } from "@/lib/expert-review-engine/types.ts";
import type {
  ExpertAssignment,
  ExpertAssignmentPlan,
  ExpertAssignmentRequest,
  SelectionReason,
  UnresolvedCapability,
} from "./types.ts";

function reason(code: SelectionReason["code"], detail: string): SelectionReason {
  return { code, detail };
}

export function recommendExperts(request: ExpertAssignmentRequest): ExpertAssignmentPlan {
  const includeDisabled = request.includeDisabled ?? false;
  const assignments: ExpertAssignment[] = [];
  const unresolved: UnresolvedCapability[] = [];
  const assignedKeys = new Set<string>();

  if (request.explicitExpertKey) {
    const entry = getExpertRuntimeDefinition(request.explicitExpertKey, { includeDisabled });
    if (entry) {
      assignments.push({
        expertKey: entry.definition.expert_key,
        expertVersion: entry.definition.expert_version,
        displayName: entry.definition.display_name,
        matchedCapabilities: [...entry.definition.capabilities],
        reasons: [reason("explicit_expert_key", `Explicit request for ${request.explicitExpertKey}`)],
      });
      assignedKeys.add(entry.definition.expert_key);
    }
  }

  for (const req of request.requestedCapabilities) {
    const matches = resolveExpertsByCapability(req.capability, { includeDisabled });
    const available = matches.filter((m) => !assignedKeys.has(m.definition.expert_key));

    if (available.length === 0) {
      if (req.required) {
        unresolved.push({
          capability: req.capability,
          reason: "No registered expert provides this capability",
        });
      }
      continue;
    }

    // Phase 1: highest priority base score wins
    const best = [...available].sort(
      (a, b) => b.definition.priority.base - a.definition.priority.base,
    )[0];

    assignments.push({
      expertKey: best.definition.expert_key,
      expertVersion: best.definition.expert_version,
      displayName: best.definition.display_name,
      matchedCapabilities: [req.capability],
      reasons: [
        reason(
          "capability_match",
          `Matched capability ${req.capability} via registry lookup`,
        ),
      ],
    });
    assignedKeys.add(best.definition.expert_key);
  }

  return {
    assignments,
    unresolved,
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
