/**
 * Reusable evidence profiles — code-defined and versioned in Phase 1.
 * Experts reference profiles and may apply stricter overrides only.
 */

import type {
  CitationRequirements,
  ConfidenceRules,
  ContraryEvidenceRequirements,
  EvidenceRequirement,
  ManuscriptAnchorRequirements,
  ExternalSourceRequirements,
  VerificationRequirements,
} from "./types.ts";
import type { EvidenceType } from "./evidence-types.ts";

export const EVIDENCE_PROFILE_SCHEMA_VERSION = "evidence_profile@v1" as const;

export const EVIDENCE_PROFILE_KEYS = [
  "EDITORIAL",
  "COMMERCIAL",
  "RESEARCH",
  "SCIENTIFIC",
  "HISTORICAL",
  "MEDICAL",
  "LEGAL",
  "PSYCHOLOGICAL",
  "PUBLISHING",
  "GENERAL_FACT_CHECKING",
] as const;

export type EvidenceProfileKey = (typeof EVIDENCE_PROFILE_KEYS)[number];

export interface EvidenceProfile {
  key: EvidenceProfileKey;
  schema_version: typeof EVIDENCE_PROFILE_SCHEMA_VERSION;
  display_name: string;
  description: string;
  allowed_evidence_types: EvidenceType[];
  per_output_requirements: EvidenceRequirement[];
  manuscript_anchor_requirements: ManuscriptAnchorRequirements;
  external_source_requirements: ExternalSourceRequirements;
  citation_requirements: CitationRequirements;
  verification_requirements: VerificationRequirements;
  contrary_evidence_requirements: ContraryEvidenceRequirements;
  confidence_rules: ConfidenceRules;
  insufficient_evidence_behavior: "block" | "downgrade" | "flag";
}

const BASE_MANUSCRIPT_ANCHOR: ManuscriptAnchorRequirements = {
  require_version_id: true,
  require_locator: true,
  max_excerpt_words: 40,
  require_verification: true,
};

const BASE_CITATION: CitationRequirements = {
  format: "structured",
  allow_urls: true,
  allow_doi: true,
};

const BASE_VERIFICATION: VerificationRequirements = {
  author_can_locate_independently: true,
  block_on_fabricated_quotes: true,
};

const BASE_CONTRARY: ContraryEvidenceRequirements = {
  required_for_repeat_criticism: true,
  search_current_manuscript: true,
  statuses_allowed_without_deduction: ["RESOLVED", "STALE_CRITIQUE"],
};

const BASE_CONFIDENCE: ConfidenceRules = {
  levels: ["HIGH", "MODERATE", "LOW", "INSUFFICIENT_EVIDENCE"],
  require_explanation: true,
  block_publish_on_insufficient: true,
};

function editorialMaterialRequirements(): EvidenceRequirement[] {
  return [
    {
      output_type: "material_criticism",
      minimum_records: 1,
      required_fields: ["claim", "evidence", "evidence_type", "reasoning", "confidence"],
      allowed_types: ["MANUSCRIPT", "ANALYTICAL", "RUBRIC"],
    },
    {
      output_type: "editorial_opinion",
      minimum_records: 1,
      required_fields: ["claim", "evidence", "evidence_type", "reasoning", "confidence"],
      allowed_types: ["MANUSCRIPT", "RUBRIC", "ANALYTICAL"],
    },
    {
      output_type: "recommendation",
      minimum_records: 1,
      required_fields: ["claim", "evidence", "reasoning", "recommendation"],
      allowed_types: ["MANUSCRIPT", "ANALYTICAL"],
    },
  ];
}

export const EVIDENCE_PROFILES: Record<EvidenceProfileKey, EvidenceProfile> = {
  EDITORIAL: {
    key: "EDITORIAL",
    schema_version: EVIDENCE_PROFILE_SCHEMA_VERSION,
    display_name: "Editorial",
    description: "Manuscript-grounded editorial criticism and recommendations.",
    allowed_evidence_types: ["MANUSCRIPT", "ANALYTICAL", "RUBRIC", "COMPARATIVE", "AUTHOR_PROVIDED"],
    per_output_requirements: editorialMaterialRequirements(),
    manuscript_anchor_requirements: BASE_MANUSCRIPT_ANCHOR,
    external_source_requirements: {
      required_when: [],
      minimum_reliability: "moderate",
      require_citation_fields: [],
    },
    citation_requirements: BASE_CITATION,
    verification_requirements: BASE_VERIFICATION,
    contrary_evidence_requirements: BASE_CONTRARY,
    confidence_rules: BASE_CONFIDENCE,
    insufficient_evidence_behavior: "block",
  },
  COMMERCIAL: {
    key: "COMMERCIAL",
    schema_version: EVIDENCE_PROFILE_SCHEMA_VERSION,
    display_name: "Commercial / Publishing",
    description: "Commercial assessments with manuscript and market-comparative evidence.",
    allowed_evidence_types: [
      "MANUSCRIPT",
      "ANALYTICAL",
      "RUBRIC",
      "COMPARATIVE",
      "EXTERNAL_SOURCE",
      "SYSTEM_METADATA",
    ],
    per_output_requirements: [
      ...editorialMaterialRequirements(),
      {
        output_type: "conclusion",
        minimum_records: 1,
        required_fields: ["claim", "evidence", "evidence_type", "reasoning", "confidence"],
        allowed_types: ["MANUSCRIPT", "RUBRIC", "COMPARATIVE", "ANALYTICAL"],
      },
    ],
    manuscript_anchor_requirements: BASE_MANUSCRIPT_ANCHOR,
    external_source_requirements: {
      required_when: ["market_comparable_claim", "category_demand_claim"],
      minimum_reliability: "moderate",
      require_citation_fields: ["title", "authority", "access_date", "identifier"],
    },
    citation_requirements: BASE_CITATION,
    verification_requirements: BASE_VERIFICATION,
    contrary_evidence_requirements: BASE_CONTRARY,
    confidence_rules: BASE_CONFIDENCE,
    insufficient_evidence_behavior: "block",
  },
  RESEARCH: {
    key: "RESEARCH",
    schema_version: EVIDENCE_PROFILE_SCHEMA_VERSION,
    display_name: "Research",
    description: "Fact and source-backed research findings.",
    allowed_evidence_types: ["MANUSCRIPT", "EXTERNAL_SOURCE", "AUTHOR_PROVIDED", "ANALYTICAL"],
    per_output_requirements: [
      {
        output_type: "factual_assertion",
        minimum_records: 1,
        required_fields: [
          "claim",
          "evidence",
          "evidence_type",
          "evidence_location",
          "reasoning",
          "confidence",
        ],
        allowed_types: ["EXTERNAL_SOURCE", "MANUSCRIPT", "AUTHOR_PROVIDED"],
      },
    ],
    manuscript_anchor_requirements: { ...BASE_MANUSCRIPT_ANCHOR, require_locator: false },
    external_source_requirements: {
      required_when: ["factual_assertion_outside_manuscript"],
      minimum_reliability: "moderate",
      require_citation_fields: ["title", "authority", "access_date", "identifier"],
    },
    citation_requirements: BASE_CITATION,
    verification_requirements: BASE_VERIFICATION,
    contrary_evidence_requirements: BASE_CONTRARY,
    confidence_rules: BASE_CONFIDENCE,
    insufficient_evidence_behavior: "block",
  },
  SCIENTIFIC: {
    key: "SCIENTIFIC",
    schema_version: EVIDENCE_PROFILE_SCHEMA_VERSION,
    display_name: "Scientific",
    description: "Scientific and technical realism with high source reliability.",
    allowed_evidence_types: ["EXTERNAL_SOURCE", "MANUSCRIPT", "AUTHOR_PROVIDED", "ANALYTICAL"],
    per_output_requirements: [
      {
        output_type: "factual_assertion",
        minimum_records: 1,
        required_fields: ["claim", "evidence", "evidence_type", "reasoning", "confidence"],
        allowed_types: ["EXTERNAL_SOURCE", "MANUSCRIPT"],
      },
    ],
    manuscript_anchor_requirements: BASE_MANUSCRIPT_ANCHOR,
    external_source_requirements: {
      required_when: ["scientific_or_technical_claim"],
      minimum_reliability: "high",
      require_citation_fields: ["title", "authority", "access_date", "identifier"],
    },
    citation_requirements: BASE_CITATION,
    verification_requirements: BASE_VERIFICATION,
    contrary_evidence_requirements: BASE_CONTRARY,
    confidence_rules: BASE_CONFIDENCE,
    insufficient_evidence_behavior: "block",
  },
  HISTORICAL: {
    key: "HISTORICAL",
    schema_version: EVIDENCE_PROFILE_SCHEMA_VERSION,
    display_name: "Historical",
    description: "Historical accuracy and period realism.",
    allowed_evidence_types: ["EXTERNAL_SOURCE", "MANUSCRIPT", "AUTHOR_PROVIDED"],
    per_output_requirements: [
      {
        output_type: "factual_assertion",
        minimum_records: 1,
        required_fields: ["claim", "evidence", "evidence_type", "reasoning", "confidence"],
        allowed_types: ["EXTERNAL_SOURCE", "MANUSCRIPT"],
      },
    ],
    manuscript_anchor_requirements: BASE_MANUSCRIPT_ANCHOR,
    external_source_requirements: {
      required_when: ["historical_claim"],
      minimum_reliability: "high",
      require_citation_fields: ["title", "authority", "access_date", "identifier"],
    },
    citation_requirements: BASE_CITATION,
    verification_requirements: BASE_VERIFICATION,
    contrary_evidence_requirements: BASE_CONTRARY,
    confidence_rules: BASE_CONFIDENCE,
    insufficient_evidence_behavior: "block",
  },
  MEDICAL: {
    key: "MEDICAL",
    schema_version: EVIDENCE_PROFILE_SCHEMA_VERSION,
    display_name: "Medical",
    description: "Medical and clinical realism.",
    allowed_evidence_types: ["EXTERNAL_SOURCE", "MANUSCRIPT", "AUTHOR_PROVIDED"],
    per_output_requirements: [
      {
        output_type: "factual_assertion",
        minimum_records: 1,
        required_fields: ["claim", "evidence", "evidence_type", "reasoning", "confidence"],
        allowed_types: ["EXTERNAL_SOURCE", "MANUSCRIPT"],
      },
    ],
    manuscript_anchor_requirements: BASE_MANUSCRIPT_ANCHOR,
    external_source_requirements: {
      required_when: ["medical_claim"],
      minimum_reliability: "high",
      require_citation_fields: ["title", "authority", "access_date", "identifier"],
    },
    citation_requirements: BASE_CITATION,
    verification_requirements: BASE_VERIFICATION,
    contrary_evidence_requirements: BASE_CONTRARY,
    confidence_rules: BASE_CONFIDENCE,
    insufficient_evidence_behavior: "block",
  },
  LEGAL: {
    key: "LEGAL",
    schema_version: EVIDENCE_PROFILE_SCHEMA_VERSION,
    display_name: "Legal",
    description: "Legal procedure and realism.",
    allowed_evidence_types: ["EXTERNAL_SOURCE", "MANUSCRIPT", "AUTHOR_PROVIDED"],
    per_output_requirements: [
      {
        output_type: "factual_assertion",
        minimum_records: 1,
        required_fields: ["claim", "evidence", "evidence_type", "reasoning", "confidence"],
        allowed_types: ["EXTERNAL_SOURCE", "MANUSCRIPT"],
      },
    ],
    manuscript_anchor_requirements: BASE_MANUSCRIPT_ANCHOR,
    external_source_requirements: {
      required_when: ["legal_claim"],
      minimum_reliability: "high",
      require_citation_fields: ["title", "authority", "access_date", "identifier"],
    },
    citation_requirements: BASE_CITATION,
    verification_requirements: BASE_VERIFICATION,
    contrary_evidence_requirements: BASE_CONTRARY,
    confidence_rules: BASE_CONFIDENCE,
    insufficient_evidence_behavior: "block",
  },
  PSYCHOLOGICAL: {
    key: "PSYCHOLOGICAL",
    schema_version: EVIDENCE_PROFILE_SCHEMA_VERSION,
    display_name: "Psychological",
    description: "Character psychology grounded in manuscript behavior.",
    allowed_evidence_types: ["MANUSCRIPT", "ANALYTICAL", "EXTERNAL_SOURCE", "AUTHOR_PROVIDED"],
    per_output_requirements: editorialMaterialRequirements(),
    manuscript_anchor_requirements: BASE_MANUSCRIPT_ANCHOR,
    external_source_requirements: {
      required_when: ["clinical_diagnosis_claim"],
      minimum_reliability: "high",
      require_citation_fields: ["title", "authority", "access_date", "identifier"],
    },
    citation_requirements: BASE_CITATION,
    verification_requirements: BASE_VERIFICATION,
    contrary_evidence_requirements: BASE_CONTRARY,
    confidence_rules: BASE_CONFIDENCE,
    insufficient_evidence_behavior: "block",
  },
  PUBLISHING: {
    key: "PUBLISHING",
    schema_version: EVIDENCE_PROFILE_SCHEMA_VERSION,
    display_name: "Publishing",
    description: "Publishing workflow and acquisition standards.",
    allowed_evidence_types: ["MANUSCRIPT", "RUBRIC", "SYSTEM_METADATA", "ANALYTICAL"],
    per_output_requirements: editorialMaterialRequirements(),
    manuscript_anchor_requirements: BASE_MANUSCRIPT_ANCHOR,
    external_source_requirements: {
      required_when: [],
      minimum_reliability: "moderate",
      require_citation_fields: [],
    },
    citation_requirements: BASE_CITATION,
    verification_requirements: BASE_VERIFICATION,
    contrary_evidence_requirements: BASE_CONTRARY,
    confidence_rules: BASE_CONFIDENCE,
    insufficient_evidence_behavior: "block",
  },
  GENERAL_FACT_CHECKING: {
    key: "GENERAL_FACT_CHECKING",
    schema_version: EVIDENCE_PROFILE_SCHEMA_VERSION,
    display_name: "General Fact Checking",
    description: "General factual verification across domains.",
    allowed_evidence_types: ["EXTERNAL_SOURCE", "MANUSCRIPT", "AUTHOR_PROVIDED"],
    per_output_requirements: [
      {
        output_type: "factual_assertion",
        minimum_records: 1,
        required_fields: ["claim", "evidence", "evidence_type", "reasoning", "confidence"],
        allowed_types: ["EXTERNAL_SOURCE", "MANUSCRIPT", "AUTHOR_PROVIDED"],
      },
    ],
    manuscript_anchor_requirements: BASE_MANUSCRIPT_ANCHOR,
    external_source_requirements: {
      required_when: ["factual_assertion_outside_manuscript"],
      minimum_reliability: "moderate",
      require_citation_fields: ["title", "authority", "access_date", "identifier"],
    },
    citation_requirements: BASE_CITATION,
    verification_requirements: BASE_VERIFICATION,
    contrary_evidence_requirements: BASE_CONTRARY,
    confidence_rules: BASE_CONFIDENCE,
    insufficient_evidence_behavior: "block",
  },
};

export function getEvidenceProfile(key: EvidenceProfileKey): EvidenceProfile {
  const profile = EVIDENCE_PROFILES[key];
  if (!profile) throw new Error(`UNKNOWN_EVIDENCE_PROFILE:${String(key)}`);
  return profile;
}

export function isEvidenceProfileKey(value: string): value is EvidenceProfileKey {
  return (EVIDENCE_PROFILE_KEYS as readonly string[]).includes(value);
}
