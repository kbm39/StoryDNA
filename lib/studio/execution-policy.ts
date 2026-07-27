/**
 * Kevin Track private execution policy — separate from global expert lifecycle.
 *
 * Does NOT mutate selectionEnabled, certificationStatus, availability, or
 * executionAllowed on registry/catalog entries.
 */

import type { ExpertCatalogEntry } from "@/lib/expert-catalog.ts";
import { classifyExpertExecution } from "./expert-classification.ts";
import { isStudioMilitaryExpertLocalOverrideEnabled } from "./military-expert-local-policy.ts";
import type { StudioExpertTier } from "./types.ts";

export interface StudioExecutionContext {
  readonly routeNamespace: "/studio";
  readonly privateUseAcknowledged?: boolean;
}

export type StudioCommercialStatus = "enabled" | "disabled" | "certified" | "experimental";

export type StudioExpertAvailability = "available" | "experimental" | "blocked" | "placeholder";

export interface StudioExecutionPolicy {
  readonly expertKey: string;
  readonly commercialStatus: StudioCommercialStatus;
  readonly studioStatus: StudioExpertAvailability;
  readonly launchable: boolean;
  readonly requiresAcknowledgment: boolean;
}

export function classifyStudioExpertTier(entry: ExpertCatalogEntry | null): StudioExpertTier {
  if (!entry) return "placeholder";
  if (entry.certificationStatus === "certified" && entry.availability === "available") {
    return "certified";
  }
  if (entry.certificationStatus === "certified") return "validated";
  if (entry.availability === "internal_only") return "experimental";
  if (entry.availability === "coming_soon" || entry.certificationStatus === "planned") {
    return "advisory_only";
  }
  return "advisory_only";
}

export function commercialStatusForEntry(entry: ExpertCatalogEntry | null): StudioCommercialStatus {
  if (!entry) return "disabled";
  if (entry.certificationStatus === "certified" && entry.selectionEnabled) return "certified";
  if (entry.certificationStatus === "certified") return "certified";
  if (entry.availability === "internal_only") return "experimental";
  return "disabled";
}

export function studioStatusForExpert(key: string): StudioExpertAvailability {
  const executionClass = classifyExpertExecution(key);
  switch (executionClass) {
    case "READY":
      return "available";
    case "EXPERIMENTAL":
      return "experimental";
    case "PLACEHOLDER":
      return "placeholder";
    case "BLOCKED":
      return "blocked";
  }
}

export function buildStudioExecutionPolicy(input: {
  readonly expertKey: string;
  readonly entry: ExpertCatalogEntry | null;
  readonly privateUseAcknowledged: boolean;
}): StudioExecutionPolicy {
  const tier = classifyStudioExpertTier(input.entry);
  const launchable =
    input.expertKey === "military_expert"
      ? isStudioMilitaryExpertLocalOverrideEnabled() && input.privateUseAcknowledged
      : studioExecutionAllowed({
          entry: input.entry,
          tier,
          context: { routeNamespace: "/studio", privateUseAcknowledged: input.privateUseAcknowledged },
        }) && classifyExpertExecution(input.expertKey) === "READY";

  return Object.freeze({
    expertKey: input.expertKey,
    commercialStatus: commercialStatusForEntry(input.entry),
    studioStatus: studioStatusForExpert(input.expertKey),
    launchable,
    requiresAcknowledgment: requiresPrivateUseAcknowledgment(tier),
  });
}

/**
 * Owner-scoped execution permission for Kevin Track.
 * Global executionAllowed remains unchanged on expert definitions.
 */
export function studioExecutionAllowed(input: {
  readonly entry: ExpertCatalogEntry | null;
  readonly tier: StudioExpertTier;
  readonly context: StudioExecutionContext;
}): boolean {
  if (!input.entry) return false;
  if (input.tier === "certified" && input.entry.selectionEnabled) return true;
  if (input.tier === "validated") return false;
  if (input.tier === "experimental" || input.tier === "advisory_only") {
    return input.context.privateUseAcknowledged === true;
  }
  return false;
}

export function requiresPrivateUseAcknowledgment(tier: StudioExpertTier): boolean {
  return tier === "experimental" || tier === "advisory_only";
}
