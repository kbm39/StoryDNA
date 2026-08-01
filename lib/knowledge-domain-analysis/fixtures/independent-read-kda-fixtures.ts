/**
 * Deterministic Independent Read fixtures for KDA-2 candidate synthesis tests.
 */

import { EIC_INDEPENDENT_READ_CONTRACT_VERSION } from "@/lib/eic-independent-read/contract.ts";
import type {
  EicIndependentReadV1,
  IndependentReadEvidence,
} from "@/lib/eic-independent-read/types.ts";
import {
  FIXTURE_INTENT_ID,
  FIXTURE_MS_ID,
  FIXTURE_READ_ID,
  FIXTURE_UNDERSTANDING_ID,
  FIXTURE_VER_ID,
  buildFixtureAuthorIntent,
  buildFixtureUnderstanding,
} from "@/lib/editorial-profile/fixtures/independent-read-fixtures.ts";

export const FIXTURE_KDA_ANALYSIS_ID = "kda-analysis-fixture-1";
export const FIXTURE_EIC_EXECUTION_ID = "eic-exec-kda-1";

export {
  FIXTURE_MS_ID,
  FIXTURE_VER_ID,
  FIXTURE_INTENT_ID,
  FIXTURE_READ_ID,
  FIXTURE_UNDERSTANDING_ID,
  buildFixtureAuthorIntent,
  buildFixtureUnderstanding,
};

function ev(
  id: string,
  chapter: string,
  observation: string,
  excerpt?: string,
  scene?: string,
): IndependentReadEvidence {
  return Object.freeze({
    evidence_id: id,
    locator: Object.freeze({
      chapter_label: chapter,
      chapter_id: chapter.toLowerCase().replace(/\s+/g, "-"),
      scene_id: scene ?? null,
    }),
    excerpt: excerpt ?? null,
    observation,
    polarity: "supporting",
    source: "manuscript",
    grounded_in_manuscript: true,
  });
}

export function buildPoliceOrganizedCrimeIndependentRead(
  overrides: Partial<EicIndependentReadV1> = {},
): EicIndependentReadV1 {
  const policeEvidence = [
    ev("ir-pol-3", "Chapter 3", "Detective squad briefing assigns surveillance roles and chain of command", "Morrison mapped the wire team.", "squad_briefing"),
    ev("ir-pol-9", "Chapter 9", "Interrogation includes waiver, counsel request, and interview termination", undefined, "interrogation"),
    ev("ir-pol-12", "Chapter 12", "Affidavit drafting and judge sign-off for wiretap"),
    ev("ir-pol-14", "Chapter 14", "Evidence logging and chain-of-custody challenge"),
    ev("ir-pol-18", "Chapter 18", "Tactical entry planning with jurisdiction coordination"),
  ];

  const organizedCrimeEvidence = [
    ev("ir-oc-2", "Chapter 2", "Crew hierarchy introduced — captain, soldiers, earners"),
    ev("ir-oc-7", "Chapter 7", "Internal discipline scene for skimming from collections"),
    ev("ir-oc-11", "Chapter 11", "Racket payments, front business, kickback pattern"),
    ev("ir-oc-15", "Chapter 15", "Informant handling — loyalty and retaliation stakes"),
    ev("ir-oc-20", "Chapter 20", "Leadership succession dispute affects climax cooperation with law enforcement"),
  ];

  const criminalLawEvidence = [
    ev("ir-cl-12", "Chapter 12", "Wire affidavit standard and prosecutorial approval"),
    ev("ir-cl-16", "Chapter 16", "Charging conference — cooperation offer framing"),
    ev("ir-cl-19", "Chapter 19", "Grand jury presentation; admissibility dispute foreshadowed"),
  ];

  const militaryEvidence = [
    ev("ir-mil-4", "Chapter 4", "Brief mention of veteran background during bar scene"),
  ];

  const identityEvidence = [policeEvidence[0]!, organizedCrimeEvidence[0]!];

  return Object.freeze({
    contract_version: EIC_INDEPENDENT_READ_CONTRACT_VERSION,
    independent_read_id: FIXTURE_READ_ID,
    manuscript_id: FIXTURE_MS_ID,
    manuscript_version_id: FIXTURE_VER_ID,
    status: "complete",
    coverage_percent: 82,
    completed_at: "2026-08-01T01:00:00.000Z",
    specialist_manuscript_access_count: 0,
    story_identity: Object.freeze({
      identity_key: "crime_fiction_thriller",
      label: "Crime fiction thriller",
      demonstration_summary: "Investigation and organized-crime spine on the page",
      evidence: identityEvidence,
      confidence: "high",
      secondary_identities: [],
    }),
    story_engines: Object.freeze([
      Object.freeze({
        engine_id: "ir-eng-investigation",
        engine_key: "investigation_engine",
        label: "Investigation",
        role: "primary",
        demonstration_summary: "Detective investigation drives Act II",
        evidence: policeEvidence.slice(0, 3),
        confidence: "high",
        materiality: "critical",
      }),
      Object.freeze({
        engine_id: "ir-eng-racket",
        engine_key: "criminal_enterprise_engine",
        label: "Criminal enterprise",
        role: "secondary",
        demonstration_summary: "Mob hierarchy drives antagonist causality",
        evidence: organizedCrimeEvidence.slice(0, 3),
        confidence: "high",
        materiality: "critical",
      }),
    ]),
    editorial_characteristics: Object.freeze([]),
    technical_characteristics: Object.freeze([
      Object.freeze({
        technical_id: "ir-tc-police",
        domain_key: "police_procedure",
        label: "Police investigation",
        observation: "Sustained detective interviews, warrants, and evidence handling across Acts I–III",
        materiality: "critical",
        confidence: "high",
        evidence: policeEvidence,
        specialist_need: "critical",
        specialist_need_rationale: "Procedural plot spine requires police authenticity",
      }),
      Object.freeze({
        technical_id: "ir-tc-oc",
        domain_key: "organized_crime",
        label: "Organized crime",
        observation: "Mob hierarchy, discipline, and racket enterprise drive antagonist decisions",
        materiality: "critical",
        confidence: "high",
        evidence: organizedCrimeEvidence,
        specialist_need: "critical",
        specialist_need_rationale: "Organized-crime authenticity affects reader trust",
      }),
      Object.freeze({
        technical_id: "ir-tc-cl",
        domain_key: "criminal_law_prosecutorial",
        label: "Prosecutorial practice",
        observation: "Charging, cooperation, and grand jury material in Act III setup",
        materiality: "high",
        confidence: "medium",
        evidence: criminalLawEvidence,
        specialist_need: "high",
        specialist_need_rationale: "Legal payoff must match investigation built earlier",
      }),
      Object.freeze({
        technical_id: "ir-tc-mil",
        domain_key: "military_tactics",
        label: "Veteran background",
        observation: "Single bar-scene reference to prior service",
        materiality: "low",
        confidence: "low",
        evidence: militaryEvidence,
        specialist_need: "none",
        specialist_need_rationale: "Incidental texture only",
      }),
    ]),
    emotional_characteristics: Object.freeze([]),
    protected_assets: Object.freeze([]),
    editorial_risks: Object.freeze([]),
    commercial_signals: Object.freeze({
      hook_strength: "developing",
      hook_evidence: [policeEvidence[0]!],
      market_lane_fit: "clear",
      market_lane_rationale: "Crime-fiction lane with procedural spine",
      differentiation_signals: ["Organized-crime authenticity"],
      commercial_risks: [],
      readiness_signal: "preliminary_developing",
      confidence: "medium",
      author_market_framing: "Literary crime novel with thriller pacing",
    }),
    vision_alignment: Object.freeze({
      destination_alignment: "substantially_aligned",
      alignment_source: "independent_read",
    }),
    is_expert_finding: false,
    ...overrides,
  });
}

export function buildIncidentalPoliceMentionRead(): EicIndependentReadV1 {
  const badgeMention = ev(
    "ir-pol-inc-1",
    "Chapter 5",
    "Protagonist notices a detective badge on the reception desk",
  );
  const engineEvidence = ev("ir-eng-1", "Chapter 1", "Opening chase establishes thriller stakes");

  return buildPoliceOrganizedCrimeIndependentRead({
    coverage_percent: 75,
    story_identity: Object.freeze({
      identity_key: "commercial_thriller",
      label: "Commercial thriller",
      demonstration_summary: "Thriller pacing with minor police texture",
      evidence: [engineEvidence, badgeMention],
      confidence: "medium",
      secondary_identities: [],
    }),
    story_engines: Object.freeze([
      Object.freeze({
        engine_id: "ir-eng-1",
        engine_key: "suspense_engine",
        label: "Suspense",
        role: "primary",
        demonstration_summary: "Chapter-level tension",
        evidence: [engineEvidence],
        confidence: "medium",
        materiality: "high",
      }),
    ]),
    technical_characteristics: Object.freeze([
      Object.freeze({
        technical_id: "ir-tc-pol-inc",
        domain_key: "police",
        label: "Police mention",
        observation: "Detective badge mentioned once in passing",
        materiality: "low",
        confidence: "low",
        evidence: [badgeMention],
        specialist_need: "none",
        specialist_need_rationale: "Incidental mention only",
      }),
      Object.freeze({
        technical_id: "ir-tc-oc",
        domain_key: "organized_crime",
        label: "Organized crime",
        observation: "Mob hierarchy and racket payments drive Act II",
        materiality: "critical",
        confidence: "high",
        evidence: [
          ev("ir-oc-2", "Chapter 2", "Crew hierarchy introduced — captain, soldiers, earners"),
          ev("ir-oc-7", "Chapter 7", "Internal discipline scene for skimming from collections"),
          ev("ir-oc-11", "Chapter 11", "Racket payments, front business, kickback pattern"),
          ev("ir-oc-15", "Chapter 15", "Informant handling — loyalty and retaliation stakes"),
          ev("ir-oc-20", "Chapter 20", "Leadership succession dispute affects climax"),
        ],
        specialist_need: "critical",
        specialist_need_rationale: "Organized-crime spine",
      }),
    ]),
    commercial_signals: Object.freeze({
      hook_strength: "developing",
      hook_evidence: [engineEvidence],
      market_lane_fit: "clear",
      market_lane_rationale: "Thriller lane",
      differentiation_signals: [],
      commercial_risks: [],
      readiness_signal: "preliminary_developing",
      confidence: "medium",
      author_market_framing: null,
    }),
  });
}

export function buildIncompleteEvidenceRead(): EicIndependentReadV1 {
  const sparse = ev("ir-sparse-1", "Chapter 1", "Possible racket reference — unclear if organized crime");
  return buildPoliceOrganizedCrimeIndependentRead({
    coverage_percent: 55,
    technical_characteristics: Object.freeze([
      Object.freeze({
        technical_id: "ir-tc-sparse",
        domain_key: "organized_crime",
        label: "Possible racket",
        observation: "Perhaps mob involvement — single unclear reference",
        materiality: "low",
        confidence: "low",
        evidence: [sparse],
        specialist_need: "low",
        specialist_need_rationale: "Insufficient grounded evidence",
      }),
    ]),
    story_engines: Object.freeze([
      Object.freeze({
        engine_id: "ir-eng-1",
        engine_key: "suspense_engine",
        label: "Suspense",
        role: "primary",
        demonstration_summary: "Limited sample",
        evidence: [sparse],
        confidence: "low",
        materiality: "low",
      }),
    ]),
  });
}
