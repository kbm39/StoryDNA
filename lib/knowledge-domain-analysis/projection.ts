import type { KdaConfidence } from "./contract.ts";
import type {
  DomainEntry,
  ProfileProjectionBundle,
  ProfileProjectionEntry,
  KnowledgeDomainAnalysisV1,
} from "./types.ts";
import { validateProfileProjectionBundle } from "./validation.ts";

export type BuildProjectionBundleInput = {
  readonly analysis: KnowledgeDomainAnalysisV1;
  readonly bundleId: string;
};

function projectionFromDomain(
  analysis: KnowledgeDomainAnalysisV1,
  domain: DomainEntry,
  projectionId: string,
  projectionType: ProfileProjectionEntry["projection_type"],
  target: ProfileProjectionEntry["projected_target_section"],
): ProfileProjectionEntry {
  return Object.freeze({
    projection_id: projectionId,
    source_analysis_id: analysis.analysis_id,
    source_analysis_status: analysis.status,
    source_domain_id: domain.domain_id,
    evidence_ids: Object.freeze(domain.evidence.map((e) => e.evidence_id)),
    confidence: domain.confidence,
    uncertainty_notes: Object.freeze([...domain.uncertainty_notes]),
    conflict_ids: Object.freeze(domain.conflicting_evidence.map((c) => c.conflict_id)),
    projection_type: projectionType,
    projected_target_section: target,
    refresh_of_projection_id: null,
    superseded_by_projection_id: null,
  });
}

/**
 * Build summarized Editorial Profile projection contract — no profile mutation.
 * @see docs/governance/implementation/STORYDNA_KNOWLEDGE_DOMAIN_ANALYSIS_PRD.md §33
 */
export function buildProfileProjectionBundle(
  input: BuildProjectionBundleInput,
):
  | { readonly ok: true; readonly bundle: ProfileProjectionBundle }
  | { readonly ok: false; readonly reason: string } {
  const { analysis, bundleId } = input;
  const projections: ProfileProjectionEntry[] = [];

  for (const domain of analysis.domains) {
    const material =
      ["central", "substantial_supporting", "limited_scene_specific"].includes(domain.centrality) &&
      ["critical", "high", "moderate"].includes(domain.materiality);

    if (!material) continue;

    projections.push(
      projectionFromDomain(
        analysis,
        domain,
        `${bundleId}-tc-${domain.domain_id}`,
        "technical_characteristic",
        "technical_characteristics",
      ),
    );
    projections.push(
      projectionFromDomain(
        analysis,
        domain,
        `${bundleId}-sr-${domain.domain_id}`,
        "specialist_requirement",
        "specialist_requirements",
      ),
    );

    if (domain.registry_gap_status) {
      projections.push(
        projectionFromDomain(
          analysis,
          domain,
          `${bundleId}-er-${domain.domain_id}`,
          "editorial_risk",
          "editorial_risks",
        ),
      );
    }

    if (domain.roadmap_relevance === "required_input" || domain.roadmap_relevance === "optional_input") {
      projections.push(
        projectionFromDomain(
          analysis,
          domain,
          `${bundleId}-ri-${domain.domain_id}`,
          "roadmap_input",
          "roadmap_inputs",
        ),
      );
    }
  }

  const bundle: ProfileProjectionBundle = Object.freeze({
    bundle_id: bundleId,
    source_analysis_id: analysis.analysis_id,
    source_analysis_updated_at: analysis.updated_at,
    projections: Object.freeze(projections),
  });

  const validation = validateProfileProjectionBundle(bundle);
  if (!validation.ok) {
    return { ok: false, reason: validation.errors.map((e) => e.message).join("; ") };
  }

  return { ok: true, bundle };
}

export function mapConfidenceToRequirementLevel(
  centrality: DomainEntry["centrality"],
  materiality: DomainEntry["materiality"],
): "critical" | "high" | "medium" | "low" | "none" {
  if (centrality === "incidental" || centrality === "not_material" || materiality === "not_material") {
    return "none";
  }
  if (centrality === "central" && materiality === "critical") return "critical";
  if (centrality === "central" || centrality === "substantial_supporting") return "high";
  if (centrality === "limited_scene_specific") return "medium";
  return "low";
}

export function mapKdaConfidenceForProjection(confidence: KdaConfidence): KdaConfidence {
  return confidence;
}
