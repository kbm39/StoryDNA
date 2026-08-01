/**
 * Deterministic KDA fixture — police / organized crime manuscript.
 * Contract representation only; no detection logic.
 */
import { KNOWLEDGE_DOMAIN_ANALYSIS_CONTRACT_VERSION } from "../contract.ts";
import type {
  CapabilityMappingEntry,
  DomainEntry,
  KdaEvidenceEntry,
  KnowledgeDomainAnalysisV1,
  RegistryGapEntry,
  SpecialistRecommendation,
} from "../types.ts";
import type { ManuscriptLocator } from "@/lib/editorial-profile/types.ts";

function locator(chapter: string, scene?: string): ManuscriptLocator {
  return Object.freeze({
    chapter_label: chapter,
    chapter_id: chapter.toLowerCase().replace(/\s+/g, "-"),
    scene_id: scene ?? null,
  });
}

export function buildKdaEvidence(input: {
  readonly id: string;
  readonly chapter: string;
  readonly scene?: string;
  readonly observation: string;
  readonly excerpt?: string;
  readonly source?: KdaEvidenceEntry["source"];
}): KdaEvidenceEntry {
  return Object.freeze({
    evidence_id: input.id,
    locator: locator(input.chapter, input.scene),
    excerpt: input.excerpt ?? null,
    paraphrased_event: null,
    observation: input.observation,
    polarity: "supporting",
    source: input.source ?? "manuscript",
    source_artifact_id: null,
    confidence: "high",
    uncertainty_notes: [],
    author_display_safe: true,
    display_safety: "author_safe",
  });
}

const policeEvidence: readonly KdaEvidenceEntry[] = Object.freeze([
  buildKdaEvidence({
    id: "ev-pol-3",
    chapter: "Chapter 3",
    scene: "squad_briefing",
    observation: "Detective squad briefing assigns surveillance roles and chain of command",
    excerpt: "Morrison mapped the wire team against the racket timeline.",
  }),
  buildKdaEvidence({
    id: "ev-pol-9",
    chapter: "Chapter 9",
    scene: "interrogation",
    observation: "Interrogation includes waiver, counsel request, and interview termination",
  }),
  buildKdaEvidence({
    id: "ev-pol-12",
    chapter: "Chapter 12",
    observation: "Affidavit drafting and judge sign-off for wiretap",
  }),
  buildKdaEvidence({
    id: "ev-pol-14",
    chapter: "Chapter 14",
    observation: "Evidence logging and chain-of-custody challenge",
  }),
  buildKdaEvidence({
    id: "ev-pol-18",
    chapter: "Chapter 18",
    observation: "Tactical entry planning with jurisdiction coordination",
  }),
]);

const organizedCrimeEvidence: readonly KdaEvidenceEntry[] = Object.freeze([
  buildKdaEvidence({
    id: "ev-oc-2",
    chapter: "Chapter 2",
    observation: "Crew hierarchy introduced — captain, soldiers, earners",
  }),
  buildKdaEvidence({
    id: "ev-oc-7",
    chapter: "Chapter 7",
    observation: "Internal discipline scene for skimming from collections",
  }),
  buildKdaEvidence({
    id: "ev-oc-11",
    chapter: "Chapter 11",
    observation: "Racket payments, front business, kickback pattern",
  }),
  buildKdaEvidence({
    id: "ev-oc-15",
    chapter: "Chapter 15",
    observation: "Informant handling — loyalty and retaliation stakes",
  }),
  buildKdaEvidence({
    id: "ev-oc-20",
    chapter: "Chapter 20",
    observation: "Leadership succession dispute affects climax cooperation with law enforcement",
  }),
]);

const criminalLawEvidence: readonly KdaEvidenceEntry[] = Object.freeze([
  buildKdaEvidence({
    id: "ev-cl-12",
    chapter: "Chapter 12",
    observation: "Wire affidavit standard and prosecutorial approval",
  }),
  buildKdaEvidence({
    id: "ev-cl-16",
    chapter: "Chapter 16",
    observation: "Charging conference — cooperation offer framing",
  }),
  buildKdaEvidence({
    id: "ev-cl-19",
    chapter: "Chapter 19",
    observation: "Grand jury presentation; admissibility dispute foreshadowed",
  }),
]);

export const policeDomainFixture: DomainEntry = Object.freeze({
  domain_id: "domain-police-1",
  domain_key: "police_procedure",
  author_facing_name: "Police procedure",
  description: "Investigation, interviews, warrants, and evidence handling drive plot turns",
  centrality: "central",
  materiality: "critical",
  narrative_role: "Investigation spine",
  manuscript_locations: Object.freeze([
    locator("Chapter 3"),
    locator("Chapter 9"),
    locator("Chapter 12"),
    locator("Chapter 14"),
    locator("Chapter 18"),
  ]),
  evidence: policeEvidence,
  confidence: "high",
  uncertainty_notes: [],
  conflicting_evidence: [],
  consequence_if_inaccurate: "Reader trust in investigation reversals would collapse",
  reader_trust_impact: "severe",
  plot_causality_impact: "drives_turning_points",
  character_credibility_impact: "severe",
  commercial_relevance: null,
  sensitivity_relevance: null,
  author_authenticity_priority: "elevates",
  capability_requirements: Object.freeze(["police_procedure"]),
  recommendation_ids: Object.freeze(["rec-police-1"]),
  sequencing: "after_structural_work",
  specialist_availability: "available",
  registry_gap_status: false,
  recommendation_status: "proposed",
  author_response_status: "none",
  roadmap_relevance: "required_input",
});

export const organizedCrimeDomainFixture: DomainEntry = Object.freeze({
  domain_id: "domain-oc-1",
  domain_key: "organized_crime",
  author_facing_name: "Organized crime",
  description: "Mob hierarchy and enterprise logic drive antagonist causality",
  centrality: "central",
  materiality: "critical",
  narrative_role: "Antagonist engine",
  manuscript_locations: Object.freeze([
    locator("Chapter 2"),
    locator("Chapter 7"),
    locator("Chapter 11"),
    locator("Chapter 15"),
    locator("Chapter 20"),
  ]),
  evidence: organizedCrimeEvidence,
  confidence: "high",
  uncertainty_notes: [],
  conflicting_evidence: [],
  consequence_if_inaccurate: "Crime-fiction readers would reject organization behavior",
  reader_trust_impact: "severe",
  plot_causality_impact: "drives_turning_points",
  character_credibility_impact: "severe",
  author_authenticity_priority: "neutral",
  capability_requirements: Object.freeze(["organized_crime"]),
  recommendation_ids: Object.freeze(["rec-oc-1"]),
  sequencing: "early",
  specialist_availability: "registry_gap",
  registry_gap_status: true,
  recommendation_status: "proposed",
  author_response_status: "none",
  roadmap_relevance: "required_input",
});

export const criminalLawDomainFixture: DomainEntry = Object.freeze({
  domain_id: "domain-cl-1",
  domain_key: "criminal_law_prosecutorial",
  author_facing_name: "Criminal law and prosecution",
  description: "Charging and admissibility affect investigative payoff",
  centrality: "substantial_supporting",
  materiality: "high",
  narrative_role: "Legal consequence thread",
  manuscript_locations: Object.freeze([
    locator("Chapter 12"),
    locator("Chapter 16"),
    locator("Chapter 19"),
  ]),
  evidence: criminalLawEvidence,
  confidence: "medium",
  uncertainty_notes: Object.freeze([
    "Act III courtroom coverage incomplete — admissibility payoff may need revision after full read.",
  ]),
  conflicting_evidence: [],
  consequence_if_inaccurate: "Legal payoff may not match investigation built",
  reader_trust_impact: "moderate",
  plot_causality_impact: "supports",
  character_credibility_impact: "moderate",
  author_authenticity_priority: "neutral",
  capability_requirements: Object.freeze(["criminal_law_prosecutorial"]),
  recommendation_ids: Object.freeze(["rec-cl-1"]),
  sequencing: "before_final_polish",
  specialist_availability: "available",
  registry_gap_status: false,
  recommendation_status: "proposed",
  author_response_status: "none",
  roadmap_relevance: "optional_input",
});

export const militaryIncidentalDomainFixture: DomainEntry = Object.freeze({
  domain_id: "domain-mil-1",
  domain_key: "military_operations",
  author_facing_name: "Military operations",
  description: "Veteran backstory mention only — no tactical plot dependency",
  centrality: "incidental",
  materiality: "not_material",
  narrative_role: null,
  manuscript_locations: Object.freeze([locator("Chapter 5")]),
  evidence: Object.freeze([
    buildKdaEvidence({
      id: "ev-mil-5",
      chapter: "Chapter 5",
      observation: "Detective's prior service mentioned in passing",
    }),
  ]),
  confidence: "medium",
  uncertainty_notes: [],
  conflicting_evidence: [],
  consequence_if_inaccurate: null,
  reader_trust_impact: "minor",
  plot_causality_impact: "minimal",
  character_credibility_impact: "minor",
  author_authenticity_priority: "unknown",
  capability_requirements: [],
  recommendation_ids: [],
  sequencing: "not_currently_recommended",
  specialist_availability: "available",
  registry_gap_status: false,
  recommendation_status: "not_recommended",
  author_response_status: "none",
  roadmap_relevance: "not_applicable",
});

export const policeCapabilityMappingFixture: CapabilityMappingEntry = Object.freeze({
  mapping_id: "map-police-1",
  domain_id: "domain-police-1",
  capability_key: "police_procedure",
  capability_scope: "Investigation, interviews, warrants, evidence handling",
  relevance_reason: "Sustained procedural plot spine",
  evidence_ids: Object.freeze(policeEvidence.map((e) => e.evidence_id)),
  confidence: "high",
  uncertainty_notes: [],
  overlaps_with_capability_keys: [],
  is_registered: true,
  is_certified: true,
  is_available: true,
  is_commercially_enabled: false,
  is_assignable: true,
  registry_gap_id: null,
});

export const organizedCrimeCapabilityMappingFixture: CapabilityMappingEntry = Object.freeze({
  mapping_id: "map-oc-1",
  domain_id: "domain-oc-1",
  capability_key: "organized_crime",
  capability_scope: "Hierarchy, enterprise logic, informant culture",
  relevance_reason: "Antagonist organization drives Act II and climax",
  evidence_ids: Object.freeze(organizedCrimeEvidence.map((e) => e.evidence_id)),
  confidence: "high",
  uncertainty_notes: [],
  overlaps_with_capability_keys: [],
  is_registered: false,
  is_certified: false,
  is_available: false,
  is_commercially_enabled: false,
  is_assignable: false,
  registry_gap_id: "gap-oc-1",
});

export const criminalLawCapabilityMappingFixture: CapabilityMappingEntry = Object.freeze({
  mapping_id: "map-cl-1",
  domain_id: "domain-cl-1",
  capability_key: "criminal_law_prosecutorial",
  capability_scope: "Charging, cooperation, grand jury, admissibility",
  relevance_reason: "Legal consequences must match investigation",
  evidence_ids: Object.freeze(criminalLawEvidence.map((e) => e.evidence_id)),
  confidence: "medium",
  uncertainty_notes: Object.freeze(["Limited prosecution scene count"]),
  overlaps_with_capability_keys: ["police_procedure"],
  is_registered: true,
  is_certified: true,
  is_available: true,
  is_commercially_enabled: false,
  is_assignable: true,
  registry_gap_id: null,
});

export const organizedCrimeRegistryGapFixture: RegistryGapEntry = Object.freeze({
  gap_id: "gap-oc-1",
  domain_id: "domain-oc-1",
  required_capability_key: "organized_crime",
  reason: "Central organized-crime authenticity with no certified capability in registry",
  evidence_ids: Object.freeze(organizedCrimeEvidence.map((e) => e.evidence_id)),
  centrality: "central",
  materiality: "critical",
  confidence: "high",
  uncertainty_notes: [],
  author_facing_explanation:
    "This manuscript materially depends on organized-crime authenticity. StoryDNA has identified that need, but an appropriate specialist is not yet available in the current editorial team.",
  unresolved_staffing_status: true,
  platform_telemetry_eligible: true,
  roadmap_dependency_eligible: true,
  created_at: "2026-08-01T00:00:00.000Z",
  resolution_status: "unresolved",
  resolution_reference: null,
});

export const policeRecommendationFixture: SpecialistRecommendation = Object.freeze({
  recommendation_id: "rec-police-1",
  domain_id: "domain-police-1",
  demonstrated_need:
    "Police work drives the investigation and several major turning points across Chapters 3, 9, 12, 14, and 18.",
  manuscript_evidence_ids: Object.freeze(policeEvidence.map((e) => e.evidence_id)),
  centrality: "central",
  materiality: "critical",
  capability_rationale:
    "Readers will judge detective interviews, warrants, evidence handling, and tactical entry against real procedure.",
  candidate_capability_key: "police_procedure",
  candidate_expert_keys: Object.freeze(["police_expert"]),
  candidate_expert_family: "law_enforcement",
  capability_coverage: "Investigation and procedural scenes in Acts I–III",
  certification_status: "certified",
  availability: "available",
  commercial_enablement_status: "not_commercially_enabled",
  manuscript_access_status: "not_shared",
  confidence: "high",
  uncertainty_notes: [],
  related_protected_asset_ids: [],
  related_risk_ids: [],
  related_opportunity_ids: [],
  sequence: "after_structural_work",
  sequencing_rationale:
    "Police procedure review is most useful once the investigation spine is stable but before line editing.",
  author_facing_explanation:
    "Police work is not background in this manuscript — it drives the investigation and several major turning points. In Chapters 3, 9, 12, 14, and 18, your detectives conduct interviews, seek warrants, handle evidence, and plan a tactical entry in ways readers will judge against real procedure. I recommend a Police Procedures specialist review that material if you approve adding that capability to your team and sharing the manuscript. No specialist has been activated yet.",
  author_response_status: "none",
  consent_status: "not_requested",
  activation_status: "not_activated",
  recommendation_status: "proposed",
  registry_gap_id: null,
});

export const organizedCrimeRecommendationFixture: SpecialistRecommendation = Object.freeze({
  recommendation_id: "rec-oc-1",
  domain_id: "domain-oc-1",
  demonstrated_need:
    "Mob hierarchy, discipline, and enterprise logic drive Act II and the climax in Chapters 2, 7, 11, 15, and 20.",
  manuscript_evidence_ids: Object.freeze(organizedCrimeEvidence.map((e) => e.evidence_id)),
  centrality: "central",
  materiality: "critical",
  capability_rationale:
    "Organized-crime authenticity affects plot causality and reader trust for crime-fiction audience.",
  candidate_capability_key: "organized_crime",
  candidate_expert_keys: [],
  candidate_expert_family: null,
  capability_coverage: "Required capability not registered",
  certification_status: "unknown",
  availability: "registry_gap",
  commercial_enablement_status: "not_commercially_enabled",
  manuscript_access_status: "not_shared",
  confidence: "high",
  uncertainty_notes: [],
  related_protected_asset_ids: [],
  related_risk_ids: [],
  related_opportunity_ids: [],
  sequence: "early",
  sequencing_rationale: "Organized-crime hierarchy drives mid-book reversal — review belongs early.",
  author_facing_explanation: organizedCrimeRegistryGapFixture.author_facing_explanation,
  author_response_status: "none",
  consent_status: "not_requested",
  activation_status: "not_activated",
  recommendation_status: "proposed",
  registry_gap_id: "gap-oc-1",
});

export const criminalLawRecommendationFixture: SpecialistRecommendation = Object.freeze({
  recommendation_id: "rec-cl-1",
  domain_id: "domain-cl-1",
  demonstrated_need:
    "Charging decisions, cooperation offers, and grand jury material in Chapters 12, 16, and 19 affect legal payoff.",
  manuscript_evidence_ids: Object.freeze(criminalLawEvidence.map((e) => e.evidence_id)),
  centrality: "substantial_supporting",
  materiality: "high",
  capability_rationale: "Prosecutorial thread is distinct from detective procedure and mob authenticity.",
  candidate_capability_key: "criminal_law_prosecutorial",
  candidate_expert_keys: Object.freeze(["criminal_law_expert"]),
  candidate_expert_family: "legal",
  capability_coverage: "Charging, cooperation, grand jury, admissibility scenes",
  certification_status: "certified",
  availability: "available",
  commercial_enablement_status: "not_commercially_enabled",
  manuscript_access_status: "not_shared",
  confidence: "medium",
  uncertainty_notes: Object.freeze([
    "Act III courtroom coverage incomplete — admissibility payoff may need revision after full read.",
  ]),
  related_protected_asset_ids: [],
  related_risk_ids: [],
  related_opportunity_ids: [],
  sequence: "before_final_polish",
  sequencing_rationale: "Legal payoff should be credible before final polish.",
  author_facing_explanation:
    "Several turning points depend on charging decisions, cooperation offers, and evidentiary admissibility — not only on detective work. A Criminal Law or Prosecutorial Practice specialist should review Chapters 12, 16, and 19 so your legal consequences match the investigation you built. No specialist has been activated yet.",
  author_response_status: "none",
  consent_status: "not_requested",
  activation_status: "not_activated",
  recommendation_status: "proposed",
  registry_gap_id: null,
});

export function buildPoliceOrganizedCrimeKdaFixture(
  overrides: Partial<KnowledgeDomainAnalysisV1> = {},
): KnowledgeDomainAnalysisV1 {
  const timestamp = "2026-08-01T00:00:00.000Z";

  return Object.freeze({
    contract_version: KNOWLEDGE_DOMAIN_ANALYSIS_CONTRACT_VERSION,
    analysis_id: "kda-fixture-1",
    manuscript_id: "ms-police-mob-1",
    manuscript_version_id: "ver-1",
    independent_read_id: "read-1",
    editorial_profile_id: null,
    author_intent_id: "intent-1",
    editorial_understanding_id: "understanding-1",
    eic_execution_id: "eic-exec-1",
    status: "awaiting_eic_confirmation",
    created_at: timestamp,
    updated_at: timestamp,
    activated_at: null,
    supersedes_analysis_id: null,
    superseded_by_analysis_id: null,
    trigger_event: "independent_read_complete",
    domains: Object.freeze([
      policeDomainFixture,
      organizedCrimeDomainFixture,
      criminalLawDomainFixture,
      militaryIncidentalDomainFixture,
    ]),
    capability_mappings: Object.freeze([
      policeCapabilityMappingFixture,
      organizedCrimeCapabilityMappingFixture,
      criminalLawCapabilityMappingFixture,
    ]),
    recommendations: Object.freeze([
      policeRecommendationFixture,
      organizedCrimeRecommendationFixture,
      criminalLawRecommendationFixture,
    ]),
    registry_gaps: Object.freeze([organizedCrimeRegistryGapFixture]),
    author_responses: [],
    eic_confirmation: null,
    provenance: Object.freeze({
      independent_read_id: "read-1",
      author_intent_id: "intent-1",
      editorial_understanding_id: "understanding-1",
      manuscript_brief_id: null,
      editorial_profile_id: null,
      synthesis_timestamp: timestamp,
      read_coverage_percent: 82,
      uncovered_regions: Object.freeze(["Act III courtroom scenes partial"]),
      specialist_manuscript_access_count: 0,
    }),
    audit_history: Object.freeze([
      Object.freeze({
        event_id: "audit-1",
        event_type: "analysis_created",
        timestamp,
        actor: "eic",
        summary: "KDA fixture created from independent read",
        related_ids: Object.freeze(["kda-fixture-1", "read-1"]),
        prior_state: "generating",
        new_state: "awaiting_eic_confirmation",
      }),
    ]),
    synthesis_confidence: Object.freeze({
      overall_confidence: "high",
      independent_read_coverage: 82,
      domains_at_low_confidence: [],
      uncovered_regions: Object.freeze(["Act III courtroom scenes partial"]),
    }),
    is_expert_finding: false,
    is_manuscript_evidence: false,
    is_author_intent: false,
    is_specialist_assignment: false,
    is_manuscript_sharing_consent: false,
    is_expert_activation: false,
    is_roadmap_generation: false,
    is_grading: false,
    ...overrides,
  });
}
