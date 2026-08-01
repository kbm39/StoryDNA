/**
 * Deterministic active Editorial Profile fixture for Studio presentation (EP-6).
 * Mirrors validation-ready profile used in EP-3/EP-5 tests — no DB persistence.
 */

import { EDITORIAL_PROFILE_CONTRACT_VERSION, type EditorialProfileStatus } from "@/lib/editorial-profile/contract.ts";
import type { EditorialProfileV1, EvidenceEntry, ManuscriptLocator } from "@/lib/editorial-profile/types.ts";
import {
  FIXTURE_INTENT_ID,
  FIXTURE_MS_ID,
  FIXTURE_PROFILE_ID,
  FIXTURE_READ_ID,
  FIXTURE_UNDERSTANDING_ID,
  FIXTURE_VER_ID,
} from "./independent-read-fixtures.ts";

function locator(chapter: string): ManuscriptLocator {
  return { chapter_label: chapter, chapter_id: chapter };
}

function evidence(id: string, chapter: string, polarity: EvidenceEntry["polarity"] = "supporting"): EvidenceEntry {
  return {
    evidence_id: id,
    locator: locator(chapter),
    observation: `Observation for ${chapter}`,
    polarity,
    source: "manuscript",
  };
}

export function buildFixtureEditorialProfile(
  overrides: Partial<EditorialProfileV1> = {},
): EditorialProfileV1 {
  const e1 = evidence("ev-1", "Chapter 1");
  const e2 = evidence("ev-2", "Chapter 2");
  const e3 = evidence("ev-3", "Chapter 3");

  const base: EditorialProfileV1 = {
    contract_version: EDITORIAL_PROFILE_CONTRACT_VERSION,
    profile_id: FIXTURE_PROFILE_ID,
    manuscript_id: FIXTURE_MS_ID,
    manuscript_version_id: FIXTURE_VER_ID,
    author_intent_id: FIXTURE_INTENT_ID,
    independent_read_id: FIXTURE_READ_ID,
    editorial_understanding_id: FIXTURE_UNDERSTANDING_ID,
    manuscript_brief_id: null,
    status: "awaiting_eic_confirmation",
    dispute_metadata: null,
    supersedes_profile_id: null,
    superseded_by_profile_id: null,
    generated_at: "2026-08-01T00:00:00.000Z",
    activated_at: null,
    trigger_event: "independent_read_complete",
    synthesis_confidence: {
      overall_confidence: "medium",
      independent_read_coverage: 75,
      sections_at_low_confidence: [],
      evidence_depth: "adequate",
      gaps_affecting_confidence: [],
    },
    story_identity: {
      primary_identity: {
        identity_key: "commercial_thriller",
        label: "Commercial thriller",
        demonstration_summary: "Sustained thriller pacing on the page",
      },
      secondary_identities: [],
      identity_rationale: "Demonstrated thriller structure and stakes",
      evidence: [e1, e2],
      confidence: "high",
      author_framing_alignment: "aligned",
    },
    story_engines: [
      {
        engine_id: "eng-1",
        engine_key: "suspense_engine",
        label: "Suspense",
        role: "primary",
        demonstration_summary: "Chapter-level tension escalation",
        evidence: [e1, e2],
        confidence: "high",
        materiality: "high",
      },
    ],
    editorial_characteristics: [
      { characteristic_id: "ec-1", domain: "structure", label: "Act shape", assessment: "strength", summary: "Clear act breaks", evidence: [e1], confidence: "medium", materiality: "high" },
      { characteristic_id: "ec-2", domain: "pacing", label: "Scene rhythm", assessment: "strength", summary: "Consistent propulsion", evidence: [e2], confidence: "medium", materiality: "moderate" },
      { characteristic_id: "ec-3", domain: "opening", label: "Hook", assessment: "developing", summary: "Promising but uneven", evidence: [], confidence: "low", materiality: "moderate" },
      { characteristic_id: "ec-4", domain: "character", label: "Motivation", assessment: "gap", summary: "Antagonist underdeveloped", evidence: [e3], confidence: "medium", materiality: "high" },
      { characteristic_id: "ec-5", domain: "dialogue", label: "Subtext", assessment: "developing", summary: "Functional exposition", evidence: [], confidence: "low", materiality: "low" },
    ],
    technical_characteristics: [
      {
        technical_id: "tc-1",
        domain_key: "military_tactics",
        label: "Tactical sequences",
        observation: "Operational detail in chapters 4 and 11",
        materiality: "high",
        confidence: "medium",
        evidence: [e3],
        specialist_need: "high",
        specialist_need_rationale: "Sustained tactical content warrants review",
      },
    ],
    emotional_characteristics: [
      { emotional_id: "em-1", emotion_key: "tension", label: "Tension", intensity: "dominant", execution_quality: "effective", summary: "Sustained dread", evidence: [e1], confidence: "medium", materiality: "high" },
      { emotional_id: "em-2", emotion_key: "hope", label: "Hope", intensity: "present", execution_quality: "uneven", summary: "Intermittent relief", evidence: [e2], confidence: "medium", materiality: "moderate" },
      { emotional_id: "em-3", emotion_key: "catharsis", label: "Catharsis", intensity: "underdeveloped", execution_quality: "not_assessable", summary: "Ending not fully assessable", evidence: [], confidence: "low", materiality: "low" },
    ],
    protected_assets: [
      { asset_id: "pa-1", category: "scene", label: "Opening raid", description: "Vivid set-piece", evidence: [e1], protection_level: "high", confidence: "medium" },
      { asset_id: "pa-2", category: "voice", label: "Narrative voice", description: "Distinct cadence", evidence: [e2], protection_level: "moderate", confidence: "medium" },
    ],
    editorial_risks: [
      {
        risk_id: "risk-1",
        label: "Antagonist clarity",
        description: "Weak antagonist may block thriller payoff",
        severity: "significant",
        likelihood: "medium",
        materiality: "high",
        evidence: [e3],
        confidence: "medium",
        mitigation_direction: "Strengthen antagonist motivation in revision",
      },
    ],
    specialist_requirements: [
      {
        requirement_id: "sr-1",
        domain_key: "military_tactics",
        requirement_level: "high",
        justification: "Sustained tactical sequences in multiple chapters",
        driving_characteristics: ["tc-1"],
        evidence_summary: "Chapters 4, 11 operational detail",
        confidence: "medium",
        author_intent_modifier: "neutral",
        publication_state_modifier: "neutral",
        series_context_modifier: "not_applicable",
      },
      {
        requirement_id: "sr-2",
        domain_key: "combat_medicine",
        requirement_level: "none",
        justification: "No demonstrated combat medicine content",
        driving_characteristics: [],
        evidence_summary: "Evaluated — no on-page signals",
        confidence: "high",
        author_intent_modifier: "not_applicable",
        publication_state_modifier: "neutral",
        series_context_modifier: "not_applicable",
      },
    ],
    commercial_characteristics: {
      commercial_assessment_scope: "pre_expert_preliminary",
      hook_strength: "developing",
      hook_evidence: [e1],
      comp_alignment_signals: [],
      market_lane_fit: "clear",
      market_lane_rationale: "Thriller identity with commercial pacing",
      differentiation_signals: ["Military insider texture"],
      commercial_risks: ["Crowded thriller market"],
      readiness_signal: "preliminary_developing",
      confidence: "medium",
      author_market_framing_alignment: "aligned",
    },
    roadmap_inputs: {
      destination_alignment: "substantially_aligned",
      alignment_source: "vision_alignment",
      primary_story_identity_key: "commercial_thriller",
      primary_engine_key: "suspense_engine",
      top_protected_asset_ids: ["pa-1", "pa-2"],
      top_editorial_risk_ids: ["risk-1"],
      specialist_requirements_summary: [
        { domain_key: "military_tactics", requirement_level: "high", priority_rank: 1 },
      ],
      distance_input_signals: [],
      readiness_input_signals: [],
      sequencing_hints: [
        { hint_key: "domain_after_structure", rationale: "Domain review after structural clarity", preliminary: true },
      ],
      roi_hints: [],
      next_action_hints: [],
      regression_risk: "medium",
      coverage_completeness: 75,
    },
    provenance: {
      author_intent_id: FIXTURE_INTENT_ID,
      independent_read_id: FIXTURE_READ_ID,
      editorial_understanding_id: FIXTURE_UNDERSTANDING_ID,
      manuscript_brief_id: null,
      synthesis_timestamp: "2026-08-01T00:00:00.000Z",
      independent_read_coverage: 75,
      specialist_manuscript_access_count: 0,
    },
    is_expert_finding: false,
    is_manuscript_evidence: false,
    is_author_intent: false,
  };

  return Object.freeze({ ...base, ...overrides });
}

export function buildFixtureActiveEditorialProfile(
  overrides: Partial<EditorialProfileV1> = {},
): EditorialProfileV1 {
  return buildFixtureEditorialProfile({
    status: "active",
    activated_at: "2026-08-01T12:00:00.000Z",
    ...overrides,
  });
}

export function buildFixtureEditorialProfileWithStatus(
  status: EditorialProfileStatus,
  overrides: Partial<EditorialProfileV1> = {},
): EditorialProfileV1 {
  return buildFixtureEditorialProfile({
    status,
    activated_at: status === "active" || status === "updated" ? "2026-08-01T12:00:00.000Z" : null,
    ...overrides,
  });
}
