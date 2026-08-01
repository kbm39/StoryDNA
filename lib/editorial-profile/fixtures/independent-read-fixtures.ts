/**
 * Deterministic independent read fixtures for EP-2 synthesis tests.
 */

import { EIC_INDEPENDENT_READ_CONTRACT_VERSION } from "@/lib/eic-independent-read/contract.ts";
import type {
  EicIndependentReadV1,
  IndependentReadEvidence,
} from "@/lib/eic-independent-read/types.ts";
import { AUTHOR_INTENT_CONTRACT_VERSION } from "@/lib/author-intent/contract.ts";
import type { AuthorIntentRecord } from "@/lib/author-intent/types.ts";
import { EDITORIAL_UNDERSTANDING_CONTRACT_VERSION } from "@/lib/editorial-understanding/contract.ts";
import type { EditorialUnderstandingRecord } from "@/lib/editorial-understanding/types.ts";

export const FIXTURE_MS_ID = "ms-fixture-1";
export const FIXTURE_VER_ID = "ver-fixture-1";
export const FIXTURE_INTENT_ID = "intent-fixture-1";
export const FIXTURE_READ_ID = "read-fixture-1";
export const FIXTURE_UNDERSTANDING_ID = "understanding-fixture-1";
export const FIXTURE_PROFILE_ID = "profile-fixture-1";

function ev(
  id: string,
  chapter: string,
  polarity: IndependentReadEvidence["polarity"] = "supporting",
): IndependentReadEvidence {
  return {
    evidence_id: id,
    locator: { chapter_label: chapter, chapter_id: chapter },
    observation: `Independent read observation for ${chapter}`,
    polarity,
    source: "manuscript",
    grounded_in_manuscript: true,
  };
}

export function buildFixtureAuthorIntent(
  overrides: Partial<AuthorIntentRecord> = {},
): AuthorIntentRecord {
  return {
    id: FIXTURE_INTENT_ID,
    manuscript_id: FIXTURE_MS_ID,
    manuscript_version_id: FIXTURE_VER_ID,
    contract_version: AUTHOR_INTENT_CONTRACT_VERSION,
    intent_type: "general_manuscript_review",
    custom_objective_text: null,
    author_success_definition: "Publishable commercial thriller with authentic tactical detail",
    requested_experts: [],
    declined_experts: [],
    priority_domains: ["commercial", "structure"],
    budget_preference: null,
    time_preference: null,
    status: "active",
    created_by: "author-1",
    superseded_by_id: null,
    supersedes_intent_id: null,
    activated_at: "2026-08-01T00:00:00.000Z",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

export function buildFixtureUnderstanding(
  overrides: Partial<EditorialUnderstandingRecord> = {},
): EditorialUnderstandingRecord {
  return {
    understanding_id: FIXTURE_UNDERSTANDING_ID,
    book_id: "book-1",
    manuscript_id: FIXTURE_MS_ID,
    manuscript_version_id: FIXTURE_VER_ID,
    contract_version: EDITORIAL_UNDERSTANDING_CONTRACT_VERSION,
    interview_type: "eic_author_intake",
    conducted_by: "editor_in_chief",
    primary_vision: "High-stakes military thriller",
    target_reader: "Commercial thriller readers",
    desired_reader_experience: "Relentless tension with authentic detail",
    market_position: "Upmarket commercial thriller",
    creative_motivation: "Tell a story about duty under pressure",
    success_definition: "Agent-ready manuscript with strong hook",
    comparison_titles: null,
    open_questions: [],
    confidence: {
      overall: 0.85,
      by_field: {
        primary_vision: 0.9,
        target_reader: 0.8,
        desired_reader_experience: 0.85,
        market_position: 0.8,
        creative_motivation: 0.85,
        success_definition: 0.9,
      },
      confirmed_at: "2026-08-01T00:00:00.000Z",
      confirmed_by: "author-1",
    },
    resolved_clarifications: [],
    conversation_history: [],
    stage_turns: [],
    understanding_summary: "Commercial military thriller with authentic tactical texture",
    version: 1,
    status: "confirmed",
    is_manuscript_evidence: false,
    is_author_intent: false,
    is_canon: false,
    created_by: "eic",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    confirmed_at: "2026-08-01T00:00:00.000Z",
    confirmed_by: "author-1",
    supersedes_understanding_id: null,
    superseded_at: null,
    provider_model: null,
    provider_cost_usd: null,
    understanding_quality: null,
    synthesis_artifacts: [],
    ...overrides,
  };
}

export function buildCompleteIndependentRead(
  overrides: Partial<EicIndependentReadV1> = {},
): EicIndependentReadV1 {
  const e1 = ev("ir-ev-1", "Chapter 1");
  const e2 = ev("ir-ev-2", "Chapter 2");
  const e3 = ev("ir-ev-3", "Chapter 4");
  const e4 = ev("ir-ev-4", "Chapter 11");

  return {
    contract_version: EIC_INDEPENDENT_READ_CONTRACT_VERSION,
    independent_read_id: FIXTURE_READ_ID,
    manuscript_id: FIXTURE_MS_ID,
    manuscript_version_id: FIXTURE_VER_ID,
    status: "complete",
    coverage_percent: 78,
    completed_at: "2026-08-01T01:00:00.000Z",
    specialist_manuscript_access_count: 0,
    story_identity: {
      identity_key: "commercial_thriller",
      label: "Commercial thriller",
      demonstration_summary: "Sustained thriller pacing and stakes on the page",
      evidence: [e1, e2],
      confidence: "high",
      secondary_identities: [],
    },
    story_engines: [
      {
        engine_id: "ir-eng-1",
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
      {
        characteristic_id: "ir-ec-1",
        domain: "structure",
        label: "Act shape",
        assessment: "strength",
        summary: "Clear act breaks",
        evidence: [e1],
        confidence: "medium",
        materiality: "high",
      },
      {
        characteristic_id: "ir-ec-2",
        domain: "pacing",
        label: "Scene rhythm",
        assessment: "strength",
        summary: "Consistent propulsion",
        evidence: [e2],
        confidence: "medium",
        materiality: "moderate",
      },
      {
        characteristic_id: "ir-ec-3",
        domain: "opening",
        label: "Hook",
        assessment: "developing",
        summary: "Promising but uneven",
        evidence: [],
        confidence: "low",
        materiality: "moderate",
      },
      {
        characteristic_id: "ir-ec-4",
        domain: "character",
        label: "Motivation",
        assessment: "gap",
        summary: "Antagonist underdeveloped",
        evidence: [e3],
        confidence: "medium",
        materiality: "high",
      },
      {
        characteristic_id: "ir-ec-5",
        domain: "dialogue",
        label: "Subtext",
        assessment: "developing",
        summary: "Functional exposition",
        evidence: [],
        confidence: "low",
        materiality: "low",
      },
    ],
    technical_characteristics: [
      {
        technical_id: "ir-tc-1",
        domain_key: "military_tactics",
        label: "Tactical sequences",
        observation: "Operational detail in chapters 4 and 11",
        materiality: "high",
        confidence: "medium",
        evidence: [e3, e4],
        specialist_need: "high",
        specialist_need_rationale: "Sustained tactical content warrants specialist review",
      },
    ],
    emotional_characteristics: [
      {
        emotional_id: "ir-em-1",
        emotion_key: "tension",
        label: "Tension",
        intensity: "dominant",
        execution_quality: "effective",
        summary: "Sustained dread",
        evidence: [e1],
        confidence: "medium",
        materiality: "high",
      },
      {
        emotional_id: "ir-em-2",
        emotion_key: "hope",
        label: "Hope",
        intensity: "present",
        execution_quality: "uneven",
        summary: "Intermittent relief",
        evidence: [e2],
        confidence: "medium",
        materiality: "moderate",
      },
      {
        emotional_id: "ir-em-3",
        emotion_key: "catharsis",
        label: "Catharsis",
        intensity: "underdeveloped",
        execution_quality: "not_assessable",
        summary: "Ending not fully assessable in read coverage",
        evidence: [],
        confidence: "low",
        materiality: "low",
      },
    ],
    protected_assets: [
      {
        asset_id: "ir-pa-1",
        category: "scene",
        label: "Opening raid",
        description: "Vivid set-piece with tactical clarity",
        evidence: [e1],
        protection_level: "high",
        confidence: "medium",
      },
      {
        asset_id: "ir-pa-2",
        category: "voice",
        label: "Narrative voice",
        description: "Distinct cadence under pressure",
        evidence: [e2],
        protection_level: "moderate",
        confidence: "medium",
      },
    ],
    editorial_risks: [
      {
        risk_id: "ir-risk-1",
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
    commercial_signals: {
      hook_strength: "developing",
      hook_evidence: [e1],
      market_lane_fit: "clear",
      market_lane_rationale: "Thriller identity with commercial pacing",
      differentiation_signals: ["Military insider texture"],
      commercial_risks: ["Crowded thriller market"],
      readiness_signal: "preliminary_developing",
      confidence: "medium",
      author_market_framing: "Literary fiction with thriller elements",
    },
    vision_alignment: {
      destination_alignment: "substantially_aligned",
      alignment_source: "independent_read",
    },
    is_expert_finding: false,
    ...overrides,
  };
}

export function buildMinimalIncompleteRead(): EicIndependentReadV1 {
  const e1 = ev("ir-ev-1", "Chapter 1");
  return buildCompleteIndependentRead({
    coverage_percent: 45,
    story_engines: [
      {
        engine_id: "ir-eng-1",
        engine_key: "suspense_engine",
        label: "Suspense",
        role: "primary",
        demonstration_summary: "Partial tension signals",
        evidence: [e1],
        confidence: "low",
        materiality: "moderate",
      },
    ],
    editorial_characteristics: [
      {
        characteristic_id: "ir-ec-1",
        domain: "structure",
        label: "Act shape",
        assessment: "developing",
        summary: "Partial coverage only",
        evidence: [e1],
        confidence: "low",
        materiality: "low",
      },
      {
        characteristic_id: "ir-ec-2",
        domain: "pacing",
        label: "Scene rhythm",
        assessment: "developing",
        summary: "Limited sample",
        evidence: [],
        confidence: "low",
        materiality: "low",
      },
    ],
    emotional_characteristics: [
      {
        emotional_id: "ir-em-1",
        emotion_key: "tension",
        label: "Tension",
        intensity: "present",
        execution_quality: "uneven",
        summary: "Uneven in sampled chapters",
        evidence: [e1],
        confidence: "low",
        materiality: "moderate",
      },
    ],
    protected_assets: [
      {
        asset_id: "ir-pa-1",
        category: "scene",
        label: "Opening raid",
        description: "Strong but isolated set-piece",
        evidence: [e1],
        protection_level: "moderate",
        confidence: "low",
      },
    ],
    technical_characteristics: [],
    editorial_risks: [],
  });
}
