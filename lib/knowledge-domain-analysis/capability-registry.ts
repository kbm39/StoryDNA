/**
 * Deterministic capability registry stub — contract-level resolution only.
 * Full Expert Registry service deferred to KDA-5.
 */
import type {
  DomainCentrality,
  KdaCapabilityKey,
  KdaConfidence,
  KdaDomainKey,
  KdaMateriality,
  SequencingClass,
  SpecialistAvailability,
} from "./contract.ts";
import type { CapabilityMappingEntry, RegistryGapEntry } from "./types.ts";

export type CapabilityRegistryEntry = {
  readonly capability_key: KdaCapabilityKey;
  readonly is_registered: boolean;
  readonly is_certified: boolean;
  readonly is_available: boolean;
  readonly is_commercially_enabled: false;
  readonly is_assignable: boolean;
  readonly candidate_expert_keys: readonly string[];
  readonly candidate_expert_family: string | null;
};

/** Registered capabilities available for deterministic KDA-2 synthesis. */
export const KDA_CAPABILITY_REGISTRY: Readonly<Record<KdaCapabilityKey, CapabilityRegistryEntry>> =
  Object.freeze({
    police_procedure: Object.freeze({
      capability_key: "police_procedure",
      is_registered: true,
      is_certified: true,
      is_available: true,
      is_commercially_enabled: false,
      is_assignable: true,
      candidate_expert_keys: Object.freeze(["police_expert"]),
      candidate_expert_family: "law_enforcement",
    }),
    organized_crime: Object.freeze({
      capability_key: "organized_crime",
      is_registered: false,
      is_certified: false,
      is_available: false,
      is_commercially_enabled: false,
      is_assignable: false,
      candidate_expert_keys: Object.freeze([]),
      candidate_expert_family: null,
    }),
    criminal_law_prosecutorial: Object.freeze({
      capability_key: "criminal_law_prosecutorial",
      is_registered: true,
      is_certified: true,
      is_available: true,
      is_commercially_enabled: false,
      is_assignable: true,
      candidate_expert_keys: Object.freeze(["criminal_law_expert"]),
      candidate_expert_family: "legal",
    }),
    military_operations: Object.freeze({
      capability_key: "military_operations",
      is_registered: true,
      is_certified: true,
      is_available: true,
      is_commercially_enabled: false,
      is_assignable: true,
      candidate_expert_keys: Object.freeze(["military_expert"]),
      candidate_expert_family: "military",
    }),
    firearms: Object.freeze({
      capability_key: "firearms",
      is_registered: false,
      is_certified: false,
      is_available: false,
      is_commercially_enabled: false,
      is_assignable: false,
      candidate_expert_keys: Object.freeze([]),
      candidate_expert_family: null,
    }),
  });

export function resolveCapabilityRegistryEntry(
  capabilityKey: KdaCapabilityKey | string,
): CapabilityRegistryEntry | null {
  if (!(capabilityKey in KDA_CAPABILITY_REGISTRY)) return null;
  return KDA_CAPABILITY_REGISTRY[capabilityKey as KdaCapabilityKey] ?? null;
}

export function defaultCapabilityForDomain(domainKey: KdaDomainKey | string): KdaCapabilityKey | null {
  const normalized = String(domainKey).toLowerCase();
  if (normalized === "police_procedure" || normalized.includes("police")) return "police_procedure";
  if (normalized === "organized_crime" || normalized.includes("organized_crime")) {
    return "organized_crime";
  }
  if (
    normalized === "criminal_law_prosecutorial" ||
    normalized.includes("criminal_law") ||
    normalized.includes("prosecutorial")
  ) {
    return "criminal_law_prosecutorial";
  }
  if (normalized === "military_operations" || normalized.includes("military")) {
    return "military_operations";
  }
  return null;
}

export function buildCapabilityMapping(input: {
  readonly mappingId: string;
  readonly domainId: string;
  readonly capabilityKey: KdaCapabilityKey;
  readonly capabilityScope: string;
  readonly relevanceReason: string;
  readonly evidenceIds: readonly string[];
  readonly confidence: KdaConfidence;
  readonly uncertaintyNotes?: readonly string[];
  readonly overlaps?: readonly string[];
  readonly registryGapId?: string | null;
}): CapabilityMappingEntry {
  const entry = resolveCapabilityRegistryEntry(input.capabilityKey);
  const registered = entry?.is_registered ?? false;
  const available = entry?.is_available ?? false;

  return Object.freeze({
    mapping_id: input.mappingId,
    domain_id: input.domainId,
    capability_key: input.capabilityKey,
    capability_scope: input.capabilityScope,
    relevance_reason: input.relevanceReason,
    evidence_ids: Object.freeze([...input.evidenceIds]),
    confidence: input.confidence,
    uncertainty_notes: Object.freeze([...(input.uncertaintyNotes ?? [])]),
    overlaps_with_capability_keys: Object.freeze([...(input.overlaps ?? [])]),
    is_registered: registered,
    is_certified: entry?.is_certified ?? false,
    is_available: available,
    is_commercially_enabled: false,
    is_assignable: entry?.is_assignable ?? false,
    registry_gap_id: available ? null : (input.registryGapId ?? null),
  });
}

export function buildRegistryGap(input: {
  readonly gapId: string;
  readonly domainId: string;
  readonly capabilityKey: KdaCapabilityKey;
  readonly reason: string;
  readonly evidenceIds: readonly string[];
  readonly centrality: DomainCentrality;
  readonly materiality: KdaMateriality;
  readonly confidence: KdaConfidence;
  readonly authorFacingExplanation: string;
  readonly createdAt: string;
}): RegistryGapEntry {
  return Object.freeze({
    gap_id: input.gapId,
    domain_id: input.domainId,
    required_capability_key: input.capabilityKey,
    reason: input.reason,
    evidence_ids: Object.freeze([...input.evidenceIds]),
    centrality: input.centrality,
    materiality: input.materiality,
    confidence: input.confidence,
    uncertainty_notes: [],
    author_facing_explanation: input.authorFacingExplanation,
    unresolved_staffing_status: true,
    platform_telemetry_eligible: true,
    roadmap_dependency_eligible: true,
    created_at: input.createdAt,
    resolution_status: "unresolved",
    resolution_reference: null,
  });
}

export function inferSpecialistAvailability(
  capabilityKey: KdaCapabilityKey,
  registryGapId: string | null,
): SpecialistAvailability {
  if (registryGapId) return "registry_gap";
  const entry = resolveCapabilityRegistryEntry(capabilityKey);
  if (!entry) return "unknown";
  if (entry.is_available) return "available";
  if (entry.is_registered) return "unavailable";
  return "registry_gap";
}

export function defaultSequencingForDomain(
  domainKey: KdaDomainKey | string,
  centrality: DomainCentrality,
): SequencingClass {
  const key = String(domainKey);
  if (centrality === "incidental" || centrality === "not_material") {
    return "not_currently_recommended";
  }
  if (key === "organized_crime" && centrality === "central") return "early";
  if (key === "police_procedure") return "after_structural_work";
  if (key === "criminal_law_prosecutorial") return "before_final_polish";
  if (key === "military_operations") return "conditional";
  return "unresolved";
}
