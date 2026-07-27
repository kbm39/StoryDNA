/**
 * Kevin Track private execution policy — separate from global expert lifecycle.
 *
 * Does NOT mutate selectionEnabled, certificationStatus, availability, or
 * executionAllowed on registry/catalog entries.
 */

import type { ExpertCatalogEntry } from "@/lib/expert-catalog.ts";
import type { StudioExpertTier } from "./types.ts";

export interface StudioExecutionContext {
  readonly routeNamespace: "/studio";
  readonly privateUseAcknowledged?: boolean;
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
