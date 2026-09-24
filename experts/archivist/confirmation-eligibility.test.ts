import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ARCHIVIST_CERTIFICATION_ENTITY_CATALOG } from "./entity-catalog.ts";
import {
  applyConfirmationEligibility,
  evaluateConfirmationEligibility,
  summarizeClassificationAdjustments,
} from "./confirmation-eligibility.ts";
import { evaluateInjuryContinuity, injuryLateralityMismatch } from "./injury-laterality.ts";
import { evaluateKnowledgeContinuity } from "./knowledge-state.ts";
import { evaluateObjectPossessionContinuity, objectAppearsUnique } from "./object-possession.ts";
import { applyArchivistLivePostprocess, liveReviewEmitsAcceptedCanon } from "./live-postprocess.ts";
import { parseAndEnvelopeArchivistModelOutput } from "./model-output.ts";
import { validateArchivistReview } from "./validation.ts";
import { evaluateContinuityCompatibility } from "./temporal-continuity.ts";
import { classifyFactPersistence } from "./fact-persistence.ts";
import type { ArchivistFinding } from "./contracts.ts";
import { ARCHIVIST_CERT_20260924_V1_EVIDENCE } from "./session-archivist-cert-20260924-v1.ts";
import { ARCHIVIST_CERT_20260924_V2_EVIDENCE } from "./session-archivist-cert-20260924-v2.ts";
import { ARCHIVIST_CERT_20260924_V3_EVIDENCE } from "./session-archivist-cert-20260924-v3.ts";
import {
  ARCHIVIST_CERT_20260924_V2_AUTHORIZED,
  ARCHIVIST_CERT_20260924_V2_SESSION_ID,
  ARCHIVIST_CERT_20260924_V3_AUTHORIZED,
  ARCHIVIST_CERT_20260924_V3_SESSION_ID,
  ARCHIVIST_CERT_20260924_V4_AUTHORIZED,
  ARCHIVIST_CERT_20260924_V4_SESSION_ID,
} from "./v4-certification-criteria.ts";
import {
  ARCHIVIST_V2_INJURY_MANUSCRIPT,
  ARCHIVIST_V2_INJURY_PAYLOAD,
  ARCHIVIST_V2_OBJECT_MANUSCRIPT,
  ARCHIVIST_V2_OBJECT_PAYLOAD,
} from "./v2-cert-regression-fixtures.ts";
import { ARCHIVIST_LIVE_MODEL_CERTIFIED } from "./live-flags.ts";
import {
  ARCHIVIST_V2_AMBIGUOUS_JOHN_PAYLOAD,
  ARCHIVIST_V2_BLUE_GREEN_FENCED,
  ARCHIVIST_V2_CLEAN_CONTROL_PAYLOAD,
  ARCHIVIST_V2_EXPLAINED_DYE_PAYLOAD,
  ARCHIVIST_V3_BLUE_GREEN_MANUSCRIPT,
  ARCHIVIST_V3_CLEAN_MANUSCRIPT,
  ARCHIVIST_V3_DYE_MANUSCRIPT,
} from "./v2-regression-fixtures.ts";
import {
  ARCHIVIST_ACCEPTED_CANON_PAYLOAD,
  ARCHIVIST_ONE_SIDED_CONFIRMED_PAYLOAD,
} from "./structured-output-failure-fixtures.ts";
import {
  ARCHIVIST_V1_ALIVE_DEAD_MANUSCRIPT,
  ARCHIVIST_V1_HAIR_DYE_MANUSCRIPT,
  ARCHIVIST_V1_INJURY_MANUSCRIPT,
  ARCHIVIST_V1_INJURY_PAYLOAD,
  ARCHIVIST_V1_KNOWLEDGE_MANUSCRIPT,
  ARCHIVIST_V1_KNOWLEDGE_PAYLOAD,
  ARCHIVIST_V1_OBJECT_MANUSCRIPT,
  ARCHIVIST_V1_OBJECT_PAYLOAD,
} from "./v1-cert-regression-fixtures.ts";
import {
  ARCHIVIST_CERTIFICATION_FIXTURES,
  FIXTURE_CONTENT_HASH,
  FIXTURE_MANUSCRIPT_ID,
  FIXTURE_MANUSCRIPT_VERSION_ID,
} from "./fixtures.ts";

const IDENTITY = {
  manuscript_id: FIXTURE_MANUSCRIPT_ID,
  manuscript_version_id: FIXTURE_MANUSCRIPT_VERSION_ID,
  content_hash: FIXTURE_CONTENT_HASH,
};

const ENTITY = { catalog: ARCHIVIST_CERTIFICATION_ENTITY_CATALOG };

function finding(overrides: Partial<ArchivistFinding>): ArchivistFinding {
  return {
    id: "f1",
    issue_type: "appearance",
    classification: "possible_continuity_conflict",
    severity: "major",
    confidence: "high",
    current_location: { locator: "Chapter 3", chapter: "3" },
    conflicting_location: { locator: "Chapter 22", chapter: "22" },
    current_evidence: [
      {
        excerpt: "Mara had blue eyes that caught the lantern light.",
        locator: "Chapter 3",
        evidence_role: "current_observation",
        verification_status: "located",
        source_kind: "manuscript",
      },
    ],
    conflicting_evidence: [
      {
        excerpt: "Mara's green eyes narrowed at the map.",
        locator: "Chapter 22",
        evidence_role: "conflicting_canon",
        verification_status: "located",
        source_kind: "manuscript",
      },
    ],
    temporal_analysis: {
      relation: "earlier_later",
      continuity_compatibility: "incompatible",
      explanation: "Different chapters.",
      current_scope: { kind: "at", chapter: "3" },
      conflicting_scope: { kind: "at", chapter: "22" },
    },
    explanation: "Blue then green with no change.",
    suggested_resolution: "Confirm eye color.",
    author_action: "pending",
    author_challenge_supported: true,
    ...overrides,
  };
}

function run(raw: unknown, manuscript: string) {
  const enveloped = parseAndEnvelopeArchivistModelOutput(raw, IDENTITY);
  assert.equal(enveloped.ok, true, enveloped.ok ? "" : enveloped.message);
  if (!enveloped.ok) throw new Error(enveloped.message);
  const review = applyArchivistLivePostprocess(enveloped.review, {
    manuscriptText: manuscript,
    useCertificationEntityCatalog: true,
  });
  const validation = validateArchivistReview(review, { manuscriptText: manuscript });
  return { review, validation };
}

describe("Archivist confirmation eligibility and laterality", () => {
  it("preserves v1/v2 12/15 and v3 13/15 official FAILs and does not authorize v4", () => {
    assert.equal(ARCHIVIST_CERT_20260924_V1_EVIDENCE.official_result, "12/15 FAIL");
    assert.equal(ARCHIVIST_CERT_20260924_V1_EVIDENCE.not_a_pass, true);
    assert.equal(ARCHIVIST_CERT_20260924_V2_EVIDENCE.official_result, "12/15 FAIL");
    assert.equal(ARCHIVIST_CERT_20260924_V2_EVIDENCE.not_a_pass, true);
    assert.equal(ARCHIVIST_CERT_20260924_V2_AUTHORIZED, false);
    assert.equal(ARCHIVIST_CERT_20260924_V2_SESSION_ID, "archivist-cert-20260924-v2");
    assert.equal(ARCHIVIST_CERT_20260924_V3_EVIDENCE.official_result, "13/15 FAIL");
    assert.equal(ARCHIVIST_CERT_20260924_V3_EVIDENCE.not_a_pass, true);
    assert.equal(ARCHIVIST_CERT_20260924_V3_AUTHORIZED, false);
    assert.equal(ARCHIVIST_CERT_20260924_V3_SESSION_ID, "archivist-cert-20260924-v3");
    assert.equal(ARCHIVIST_CERT_20260924_V4_AUTHORIZED, false);
    assert.equal(ARCHIVIST_CERT_20260924_V4_SESSION_ID, "archivist-cert-20260924-v4");
    assert.equal(ARCHIVIST_LIVE_MODEL_CERTIFIED, true);
  });

  it("promotes an eligible possible finding and records the audit", () => {
    const result = evaluateConfirmationEligibility(finding({}), { entityContext: ENTITY });
    assert.equal(result.eligibility, "eligible");
    assert.equal(result.final_classification, "confirmed_contradiction");
    assert.equal(result.adjustment, "promoted");
    const applied = applyConfirmationEligibility(finding({}), { entityContext: ENTITY });
    assert.equal(applied.model_classification, "possible_continuity_conflict");
    assert.equal(applied.classification, "confirmed_contradiction");
    assert.ok(applied.classification_adjustment_reason?.includes("verified"));
  });

  it("does not promote merely because two excerpts exist", () => {
    const result = evaluateConfirmationEligibility(
      finding({
        temporal_analysis: {
          relation: "earlier_later",
          continuity_compatibility: "compatible_change",
          explanation: "After the dye.",
          current_scope: { kind: "at", chapter: "3" },
          conflicting_scope: { kind: "at", chapter: "22" },
        },
      }),
      { entityContext: ENTITY },
    );
    assert.notEqual(result.eligibility, "eligible");
    assert.equal(result.final_classification, "possible_continuity_conflict");
  });

  it("downgrades a confirmed finding that is not eligible", () => {
    const result = evaluateConfirmationEligibility(
      finding({
        classification: "confirmed_contradiction",
        conflicting_evidence: [],
        conflicting_location: undefined,
        temporal_analysis: {
          relation: "unknown",
          continuity_compatibility: "insufficient_evidence",
          explanation: "One side only.",
          current_scope: { kind: "at", chapter: "3" },
        },
      }),
      { entityContext: ENTITY },
    );
    assert.equal(result.adjustment, "downgraded");
    assert.notEqual(result.final_classification, "confirmed_contradiction");
  });

  it("treats same-time left/right injury laterality as incompatible", () => {
    const injury = finding({
      issue_type: "injury",
      current_location: { locator: "Chapter 11", chapter: "11" },
      conflicting_location: { locator: "Chapter 11", chapter: "11" },
      current_evidence: [
        {
          excerpt: "The wound on Mara's left shoulder had closed.",
          locator: "Chapter 11",
          evidence_role: "current_observation",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      conflicting_evidence: [
        {
          excerpt: "The medic wrapped Mara's right shoulder.",
          locator: "Chapter 11",
          evidence_role: "conflicting_canon",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      temporal_analysis: {
        relation: "same_time",
        explanation: "No evidence indicates the wound healed and relocated.",
        current_scope: { kind: "at", chapter: "11" },
        conflicting_scope: { kind: "at", chapter: "11" },
      },
    });
    assert.equal(injuryLateralityMismatch(injury), true);
    assert.equal(evaluateInjuryContinuity(injury).compatibility, "incompatible");
    assert.equal(evaluateContinuityCompatibility(injury), "incompatible");
    assert.equal(classifyFactPersistence({ factType: "injury" }), "stateful_changeable");
  });

  it("does not force laterality incompatibility when a second injury is established", () => {
    const injury = finding({
      issue_type: "injury",
      current_location: { locator: "Chapter 11", chapter: "11" },
      conflicting_location: { locator: "Chapter 11", chapter: "11" },
      current_evidence: [
        {
          excerpt: "The wound on Mara's left shoulder had closed.",
          locator: "Chapter 11",
          evidence_role: "current_observation",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      conflicting_evidence: [
        {
          excerpt: "A second wound opened on Mara's right shoulder.",
          locator: "Chapter 11",
          evidence_role: "conflicting_canon",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      temporal_analysis: {
        relation: "same_time",
        explanation: "Two separate injuries.",
        current_scope: { kind: "at", chapter: "11" },
        conflicting_scope: { kind: "at", chapter: "11" },
      },
    });
    assert.equal(evaluateInjuryContinuity(injury).same_injury, false);
    const eligibility = evaluateConfirmationEligibility(
      {
        ...injury,
        temporal_analysis: {
          ...injury.temporal_analysis,
          continuity_compatibility: "compatible_change",
        },
      },
      { entityContext: ENTITY },
    );
    assert.notEqual(eligibility.final_classification, "confirmed_contradiction");
  });

  it("marks knowledge used before acquisition as incompatible", () => {
    const knowledge = finding({
      issue_type: "knowledge_state",
      current_location: { locator: "Chapter 2", chapter: "2" },
      conflicting_location: { locator: "Chapter 4", chapter: "4" },
      current_evidence: [
        {
          excerpt: "Mara whispered the courier password at the gate.",
          locator: "Chapter 2",
          evidence_role: "current_observation",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      conflicting_evidence: [
        {
          excerpt: "Mara learned the courier password at dusk.",
          locator: "Chapter 4",
          evidence_role: "conflicting_canon",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
    });
    assert.equal(evaluateKnowledgeContinuity(knowledge).compatibility, "incompatible");
    assert.equal(evaluateContinuityCompatibility(knowledge), "incompatible");
  });

  it("treats overlapping unique-object possession as incompatible", () => {
    const object = finding({
      issue_type: "possession",
      current_location: { locator: "Chapter 7", chapter: "7" },
      conflicting_location: { locator: "Chapter 7", chapter: "7" },
      current_evidence: [
        {
          excerpt: "The silver compass sat in Mara's coat pocket.",
          locator: "Chapter 7",
          evidence_role: "current_observation",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      conflicting_evidence: [
        {
          excerpt: "Calder spun the silver compass on the chart table.",
          locator: "Chapter 7",
          evidence_role: "conflicting_canon",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      temporal_analysis: {
        relation: "same_time",
        explanation: "Same unique object.",
        current_scope: { kind: "at", chapter: "7" },
        conflicting_scope: { kind: "at", chapter: "7" },
      },
      explanation: "The unique silver compass is in two places.",
    });
    assert.equal(objectAppearsUnique(object), true);
    assert.equal(evaluateObjectPossessionContinuity(object).compatibility, "incompatible");
  });

  it("does not treat a generic knife as a unique object", () => {
    const generic = finding({
      issue_type: "possession",
      current_evidence: [
        {
          excerpt: "Mara slipped a knife into her belt.",
          locator: "Chapter 7",
          evidence_role: "current_observation",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      conflicting_evidence: [
        {
          excerpt: "Calder wiped a knife on the chart table.",
          locator: "Chapter 7",
          evidence_role: "conflicting_canon",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
    });
    assert.equal(objectAppearsUnique(generic), false);
    const eligibility = evaluateConfirmationEligibility(
      {
        ...generic,
        temporal_analysis: {
          ...generic.temporal_analysis,
          continuity_compatibility: "unexplained_change",
        },
      },
      { entityContext: ENTITY },
    );
    assert.equal(eligibility.final_classification, "possible_continuity_conflict");
  });

  it("confirms the v2 injury and object shapes after assertion filtering", () => {
    const injury = run(ARCHIVIST_V2_INJURY_PAYLOAD, ARCHIVIST_V2_INJURY_MANUSCRIPT);
    assert.equal(injury.validation.ok, true, injury.validation.errors.join("; "));
    assert.equal(injury.review.findings[0]?.final_classification, "confirmed_contradiction");
    assert.equal(injury.review.findings[0]?.confirmation_eligibility, "eligible");
    assert.equal(
      injury.review.findings[0]?.temporal_analysis.continuity_compatibility,
      "incompatible",
    );

    const object = run(ARCHIVIST_V2_OBJECT_PAYLOAD, ARCHIVIST_V2_OBJECT_MANUSCRIPT);
    assert.equal(object.validation.ok, true, object.validation.errors.join("; "));
    assert.equal(object.review.findings[0]?.final_classification, "confirmed_contradiction");
    assert.equal(object.review.findings[0]?.confirmation_eligibility, "eligible");
    assert.ok(
      object.review.findings[0]?.temporal_analysis.continuity_compatibility === "incompatible" ||
        object.review.findings[0]?.temporal_analysis.continuity_compatibility === "unexplained_change",
    );
  });

  it("promotes the three v1 missed cases to final confirmed", () => {
    const injury = run(ARCHIVIST_V1_INJURY_PAYLOAD, ARCHIVIST_V1_INJURY_MANUSCRIPT);
    assert.equal(injury.validation.ok, true, injury.validation.errors.join("; "));
    assert.equal(injury.review.findings[0]?.model_classification, "confirmed_contradiction");
    assert.equal(injury.review.findings[0]?.classification, "confirmed_contradiction");
    assert.equal(injury.review.findings[0]?.temporal_analysis.relation, "same_time");
    assert.equal(injury.review.findings[0]?.temporal_analysis.continuity_compatibility, "incompatible");

    const knowledge = run(ARCHIVIST_V1_KNOWLEDGE_PAYLOAD, ARCHIVIST_V1_KNOWLEDGE_MANUSCRIPT);
    assert.equal(knowledge.validation.ok, true, knowledge.validation.errors.join("; "));
    assert.equal(knowledge.review.findings[0]?.model_classification, "possible_continuity_conflict");
    assert.equal(knowledge.review.findings[0]?.classification, "confirmed_contradiction");
    assert.equal(knowledge.review.findings[0]?.temporal_analysis.continuity_compatibility, "incompatible");

    const object = run(ARCHIVIST_V1_OBJECT_PAYLOAD, ARCHIVIST_V1_OBJECT_MANUSCRIPT);
    assert.equal(object.validation.ok, true, object.validation.errors.join("; "));
    assert.equal(object.review.findings[0]?.model_classification, "possible_continuity_conflict");
    assert.equal(object.review.findings[0]?.classification, "confirmed_contradiction");
    assert.ok(
      object.review.findings[0]?.temporal_analysis.continuity_compatibility === "incompatible" ||
        object.review.findings[0]?.temporal_analysis.continuity_compatibility === "unexplained_change",
    );
    const metrics = summarizeClassificationAdjustments(knowledge.review.findings);
    assert.equal(metrics.deterministic_promotions, 1);
    assert.equal(metrics.model_confirmed_count, 0);
    assert.equal(metrics.final_confirmed_count, 1);
  });

  it("keeps existing confirmation and non-confirmation controls", () => {
    const blue = run(ARCHIVIST_V2_BLUE_GREEN_FENCED, ARCHIVIST_V3_BLUE_GREEN_MANUSCRIPT);
    assert.equal(blue.review.findings[0]?.classification, "confirmed_contradiction");

    const dye = run(ARCHIVIST_V2_EXPLAINED_DYE_PAYLOAD, ARCHIVIST_V3_DYE_MANUSCRIPT);
    assert.equal(
      dye.review.findings.filter((item) => item.classification === "confirmed_contradiction").length,
      0,
    );

    const hair = run(
      {
        ...ARCHIVIST_V2_EXPLAINED_DYE_PAYLOAD,
        findings: [
          {
            ...ARCHIVIST_V2_EXPLAINED_DYE_PAYLOAD.findings[0],
            current_evidence: [
              {
                excerpt: "Mara's hair was brown against the lantern light.",
                locator: "Chapter 3",
                evidence_role: "current_observation",
                verification_status: "located",
                source_kind: "manuscript",
              },
            ],
            conflicting_evidence: [
              {
                excerpt: "After the dye, Mara's blonde hair suited the cover identity.",
                locator: "Chapter 22",
                evidence_role: "conflicting_canon",
                verification_status: "located",
                source_kind: "manuscript",
              },
            ],
          },
        ],
      },
      ARCHIVIST_V1_HAIR_DYE_MANUSCRIPT,
    );
    assert.equal(
      hair.review.findings.filter((item) => item.classification === "confirmed_contradiction").length,
      0,
    );

    const clean = run(ARCHIVIST_V2_CLEAN_CONTROL_PAYLOAD, ARCHIVIST_V3_CLEAN_MANUSCRIPT);
    assert.equal(clean.review.findings.length, 0);
    assert.equal(
      clean.review.findings.filter((item) => item.classification === "confirmed_contradiction").length,
      0,
    );

    const john = run(ARCHIVIST_V2_AMBIGUOUS_JOHN_PAYLOAD, "Chapter 8. John closed the ledger.");
    assert.equal(john.review.canon_delta[0]?.entity.resolution, "ambiguous");
    assert.equal(john.review.entity_ambiguities[0]?.candidate_entities.length, 2);
  });

  it("does not confirm alive/dead valid transitions or retcons", () => {
    const alive = run(
      {
        summary: { narrative: "Alive then dead." },
        findings: [
          {
            id: "f-mara-alive-dead-001",
            issue_type: "alive_status",
            classification: "author_verification_needed",
            severity: "minor",
            confidence: "medium",
            current_location: { locator: "Chapter 3", chapter: "3" },
            conflicting_location: { locator: "Chapter 5", chapter: "5" },
            current_evidence: [
              {
                excerpt: "Mara kept watch at the door.",
                locator: "Chapter 3",
                evidence_role: "current_observation",
                verification_status: "located",
                source_kind: "manuscript",
              },
            ],
            conflicting_evidence: [
              {
                excerpt: "Mara died in the stairwell after the shot.",
                locator: "Chapter 5",
                evidence_role: "conflicting_canon",
                verification_status: "located",
                source_kind: "manuscript",
              },
            ],
            temporal_analysis: {
              relation: "earlier_later",
              explanation: "She dies later.",
              current_scope: { kind: "at", chapter: "3" },
              conflicting_scope: { kind: "at", chapter: "5" },
            },
            explanation: "Alive earlier, dies later.",
            suggested_resolution: "Treat as a valid death.",
          },
        ],
        canon_delta: [],
        entity_ambiguities: [],
      },
      ARCHIVIST_V1_ALIVE_DEAD_MANUSCRIPT,
    );
    assert.equal(
      alive.review.findings.filter((item) => item.classification === "confirmed_contradiction").length,
      0,
    );

    const retcon = evaluateConfirmationEligibility(
      finding({
        issue_type: "age",
        classification: "possible_continuity_conflict",
        conflicting_canon_status: "superseded",
        conflicting_authority: "author_approved_exception",
        temporal_analysis: {
          relation: "earlier_later",
          continuity_compatibility: "unexplained_change",
          explanation: "Superseded age.",
          current_scope: { kind: "at", chapter: "1" },
          conflicting_scope: { kind: "at", book_order: 1 },
        },
      }),
      { entityContext: ENTITY },
    );
    assert.notEqual(retcon.final_classification, "confirmed_contradiction");
  });

  it("blocks false promotions on unresolved, uncertain, one-sided, transfer, and accepted-canon safety", () => {
    const unresolved = evaluateConfirmationEligibility(
      finding({
        explanation: "Nobody stood at the rail.",
        current_evidence: [
          {
            excerpt: "Nobody stood at the rail.",
            locator: "Chapter 1",
            evidence_role: "current_observation",
            verification_status: "located",
            source_kind: "manuscript",
          },
        ],
        conflicting_evidence: [
          {
            excerpt: "Someone else stood at the rail later.",
            locator: "Chapter 2",
            evidence_role: "conflicting_canon",
            verification_status: "located",
            source_kind: "manuscript",
          },
        ],
      }),
      { entityContext: ENTITY },
    );
    assert.notEqual(unresolved.final_classification, "confirmed_contradiction");

    const uncertain = evaluateConfirmationEligibility(
      finding({
        issue_type: "rank_title",
        classification: "author_verification_needed",
        confidence: "insufficient",
        conflicting_evidence: [],
        conflicting_location: undefined,
        temporal_analysis: {
          relation: "unknown",
          continuity_compatibility: "insufficient_evidence",
          explanation: "Thin mention.",
          current_scope: { kind: "unknown" },
        },
      }),
      { entityContext: ENTITY },
    );
    assert.notEqual(uncertain.final_classification, "confirmed_contradiction");

    const oneSided = run(
      ARCHIVIST_ONE_SIDED_CONFIRMED_PAYLOAD,
      ARCHIVIST_V3_BLUE_GREEN_MANUSCRIPT,
    );
    assert.equal(
      oneSided.review.findings.filter((item) => item.classification === "confirmed_contradiction")
        .length,
      0,
    );

    const transfer = evaluateConfirmationEligibility(
      finding({
        issue_type: "possession",
        current_location: { locator: "Chapter 7", chapter: "7" },
        conflicting_location: { locator: "Chapter 8", chapter: "8" },
        current_evidence: [
          {
            excerpt: "The silver compass sat in Mara's coat pocket.",
            locator: "Chapter 7",
            evidence_role: "current_observation",
            verification_status: "located",
            source_kind: "manuscript",
          },
        ],
        conflicting_evidence: [
          {
            excerpt: "Mara handed Calder the silver compass.",
            locator: "Chapter 8",
            evidence_role: "conflicting_canon",
            verification_status: "located",
            source_kind: "manuscript",
          },
        ],
        temporal_analysis: {
          relation: "earlier_later",
          continuity_compatibility: "compatible_change",
          explanation: "Explicit transfer.",
          current_scope: { kind: "at", chapter: "7" },
          conflicting_scope: { kind: "at", chapter: "8" },
        },
        explanation: "Mara handed Calder the silver compass.",
      }),
      { entityContext: ENTITY },
    );
    assert.notEqual(transfer.final_classification, "confirmed_contradiction");

    const accepted = parseAndEnvelopeArchivistModelOutput(ARCHIVIST_ACCEPTED_CANON_PAYLOAD, IDENTITY);
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    const acceptedPost = applyArchivistLivePostprocess(accepted.review, {
      useCertificationEntityCatalog: true,
    });
    assert.equal(liveReviewEmitsAcceptedCanon(acceptedPost), true);
    assert.equal(validateArchivistReview(acceptedPost).ok, false);
  });

  it("does not regress the fifteen certification fixtures after postprocess", () => {
    for (const fixture of ARCHIVIST_CERTIFICATION_FIXTURES) {
      const review = applyArchivistLivePostprocess(fixture.review, {
        manuscriptText: fixture.manuscript_text,
        useCertificationEntityCatalog: true,
      });
      const confirmed = review.findings.filter(
        (item) => item.classification === "confirmed_contradiction",
      ).length;
      if (fixture.expect.validation_ok && fixture.expect.confirmed_count > 0) {
        assert.ok(confirmed >= fixture.expect.confirmed_count, fixture.id);
      } else {
        assert.equal(confirmed, 0, fixture.id);
      }
    }
  });
});
