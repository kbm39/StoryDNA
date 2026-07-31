/**
 * EIC plan gate — blocks expert launch when intent is missing or invalid.
 * Never launches providers or workflows.
 */

import { isKnownExpertKey } from "@/lib/author-intent/expert-keys.ts";
import type { AuthorIntentRecord } from "@/lib/author-intent/types.ts";
import { assertContractVersion } from "@/lib/author-intent/validation.ts";
import { classifyExpertExecution } from "@/lib/studio/expert-classification.ts";
import { isStudioMilitaryExpertLocalOverrideEnabled } from "@/lib/studio/military-expert-local-policy.ts";
import type { EicEditorialPlanRecord, EicPlanGateResult } from "./contract.ts";
import { isEicPlanGateActive } from "./feature-flag.ts";
import { buildDeterministicEicPlan } from "./recommendations.ts";

function isExpertAvailableForRequest(key: string): boolean {
  if (key === "literary_agent") {
    return classifyExpertExecution(key) === "READY";
  }
  if (key === "military_expert") {
    return isStudioMilitaryExpertLocalOverrideEnabled();
  }
  return false;
}

export function evaluateEicPlanGate(input: {
  gateEnabled?: boolean;
  manuscriptId: string;
  manuscriptVersionId: string;
  activeIntent: AuthorIntentRecord | null;
  existingActivePlan: EicEditorialPlanRecord | null;
  expertKeyToLaunch?: string;
}): EicPlanGateResult {
  const gateActive = input.gateEnabled ?? isEicPlanGateActive();

  if (!gateActive) {
    return {
      allowed: false,
      reason: "gate_disabled",
      message: "EIC plan gate is disabled — legacy launch path applies.",
    };
  }

  const { activeIntent } = input;
  if (!activeIntent) {
    return {
      allowed: false,
      reason: "missing_intent",
      message: "Author Intent is required before expert launch. Declare your goal in Studio.",
    };
  }

  if (activeIntent.status !== "active") {
    return {
      allowed: false,
      reason: "invalid_intent",
      message: `Author Intent status must be active (current: ${activeIntent.status}).`,
    };
  }

  if (!assertContractVersion(activeIntent.contract_version)) {
    return {
      allowed: false,
      reason: "invalid_intent",
      message: "Author Intent contract version is unsupported.",
    };
  }

  if (activeIntent.manuscript_id !== input.manuscriptId) {
    return {
      allowed: false,
      reason: "invalid_intent",
      message: "Author Intent manuscript ID does not match.",
    };
  }

  if (activeIntent.manuscript_version_id !== input.manuscriptVersionId) {
    return {
      allowed: false,
      reason: "version_mismatch",
      message: "Author Intent is scoped to a different manuscript version.",
    };
  }

  if (
    input.existingActivePlan &&
    input.existingActivePlan.author_intent_id !== activeIntent.id &&
    (input.existingActivePlan.status === "awaiting_author_confirmation" ||
      input.existingActivePlan.status === "confirmed")
  ) {
    return {
      allowed: false,
      reason: "conflicting_plan",
      message: "An active EIC plan exists for a different intent. Supersede or confirm first.",
    };
  }

  if (input.expertKeyToLaunch) {
    if (!isKnownExpertKey(input.expertKeyToLaunch)) {
      return {
        allowed: false,
        reason: "unknown_expert",
        message: `Unknown expert key: ${input.expertKeyToLaunch}`,
      };
    }

    if (
      activeIntent.requested_experts.includes(input.expertKeyToLaunch) &&
      !isExpertAvailableForRequest(input.expertKeyToLaunch)
    ) {
      return {
        allowed: false,
        reason: "requested_unavailable",
        message: `Requested expert is unavailable: ${input.expertKeyToLaunch}`,
      };
    }
  }

  const plan = buildDeterministicEicPlan({ intent: activeIntent });
  const planId = input.existingActivePlan?.id ?? "pending";

  return { allowed: true, plan, planId };
}

export function gateBlocksLaunch(result: EicPlanGateResult): boolean {
  if (!result.allowed) {
    return result.reason !== "gate_disabled";
  }
  return false;
}
