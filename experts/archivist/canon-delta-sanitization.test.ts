import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyArchivistCanonDeltaSanitization,
  assignSafeCandidateAuthority,
  proposedFactValueIsEmpty,
  summarizeCanonDeltaDispositions,
} from "./canon-delta-sanitization.ts";
import { applyArchivistLivePostprocess, liveReviewEmitsAcceptedCanon } from "./live-postprocess.ts";
import { parseAndEnvelopeArchivistModelOutput } from "./model-output.ts";
import { normalizeArchivistReview } from "./normalization.ts";
import { validateArchivistReview } from "./validation.ts";
import { summarizeClassificationAdjustments } from "./confirmation-eligibility.ts";
import { ARCHIVIST_CERTIFICATION_ENTITY_CATALOG } from "./entity-catalog.ts";
import { ARCHIVIST_FIXTURE_PRIOR_SOURCE_IDS } from "./prior-source-catalog.ts";
import { ARCHIVIST_ACCEPTED_CANON_PAYLOAD } from "./structured-output-failure-fixtures.ts";
import {
  ARCHIVIST_CERTIFICATION_FIXTURES,
  FIXTURE_CONTENT_HASH,
  FIXTURE_MANUSCRIPT_ID,
  FIXTURE_MANUSCRIPT_VERSION_ID,
  FIXTURE_01_WITHIN_BOOK_EXACT,
  FIXTURE_03_SERIES_AGE,
  FIXTURE_13_CLEAN_CONTROL,
  FIXTURE_14_CANON_PROMOTION,
} from "./fixtures.ts";
import {
  ARCHIVIST_V3_RELATIONSHIP_MANUSCRIPT,
  ARCHIVIST_V3_RELATIONSHIP_PAYLOAD,
  ARCHIVIST_V3_TIMELINE_MANUSCRIPT,
  ARCHIVIST_V3_TIMELINE_PAYLOAD,
} from "./v3-cert-regression-fixtures.ts";
import { ARCHIVIST_CERT_20260924_V3_EVIDENCE } from "./session-archivist-cert-20260924-v3.ts";
import {
  ARCHIVIST_CERT_20260924_V3_AUTHORIZED,
  ARCHIVIST_CERT_20260924_V3_OFFICIAL_RESULT,
  ARCHIVIST_CERT_20260924_V3_SESSION_ID,
  ARCHIVIST_CERT_20260924_V4_AUTHORIZED,
  ARCHIVIST_CERT_20260924_V4_SESSION_ID,
} from "./v4-certification-criteria.ts";
import { ARCHIVIST_LIVE_MODEL_CERTIFIED } from "./live-flags.ts";
import type { ArchivistCanonDelta, ArchivistReview } from "./contracts.ts";

const IDENTITY = {
  manuscript_id: FIXTURE_MANUSCRIPT_ID,
  manuscript_version_id: FIXTURE_MANUSCRIPT_VERSION_ID,
  content_hash: FIXTURE_CONTENT_HASH,
};

function run(raw: unknown, manuscript: string) {
  const enveloped = parseAndEnvelopeArchivistModelOutput(raw, IDENTITY);
  assert.equal(enveloped.ok, true, enveloped.ok ? "" : enveloped.message);
  if (!enveloped.ok) throw new Error(enveloped.message);
  const review = applyArchivistLivePostprocess(enveloped.review, {
    manuscriptText: manuscript,
    useCertificationEntityCatalog: true,
    entityContext: { catalog: ARCHIVIST_CERTIFICATION_ENTITY_CATALOG },
  });
  const validation = validateArchivistReview(review, { manuscriptText: manuscript });
  return { review, validation };
}

function candidate(overrides: Partial<ArchivistCanonDelta> = {}): ArchivistCanonDelta {
  return {
    id: "delta-1",
    entity: {
      resolution: "resolved",
      alias: "Mara",
      entity_type: "person",
      entity_id: "fixture-entity-mara",
    },
    entity_type: "person",
    fact_type: "appearance",
    proposed_fact_value: { eye_color: "blue" },
    temporal_scope: { kind: "at", chapter: "3" },
    source_location: { locator: "Chapter 3" },
    evidence: [
      {
        excerpt: "Mara had blue eyes that caught the lantern light.",
        locator: "Chapter 3",
        evidence_role: "current_observation",
        verification_status: "located",
        source_kind: "manuscript",
      },
    ],
    confidence: "high",
    proposed_authority: "current_observation",
    status: "candidate",
    inferred: false,
    ...overrides,
  };
}

function reviewWithDeltas(deltas: ArchivistCanonDelta[]): ArchivistReview {
  return {
    ...FIXTURE_13_CLEAN_CONTROL.review,
    canon_delta: deltas,
  };
}

describe("Archivist canon-delta sanitization", () => {
  it("preserves v3 as official 13/15 FAIL and does not authorize v4", () => {
    assert.equal(ARCHIVIST_CERT_20260924_V3_EVIDENCE.official_result, "13/15 FAIL");
    assert.equal(ARCHIVIST_CERT_20260924_V3_EVIDENCE.not_a_pass, true);
    assert.equal(ARCHIVIST_CERT_20260924_V3_EVIDENCE.total_cost_usd, 0.110039);
    assert.equal(ARCHIVIST_CERT_20260924_V3_OFFICIAL_RESULT, "13/15 FAIL");
    assert.equal(ARCHIVIST_CERT_20260924_V3_AUTHORIZED, false);
    assert.equal(ARCHIVIST_CERT_20260924_V3_SESSION_ID, "archivist-cert-20260924-v3");
    assert.equal(ARCHIVIST_CERT_20260924_V4_AUTHORIZED, false);
    assert.equal(ARCHIVIST_CERT_20260924_V4_SESSION_ID, "archivist-cert-20260924-v4");
    assert.equal(ARCHIVIST_LIVE_MODEL_CERTIFIED, true);
  });

  it("drops an empty proposed_fact_value without inventing a value or failing the review", () => {
    const sanitized = applyArchivistCanonDeltaSanitization(
      reviewWithDeltas([
        candidate({ id: "empty", proposed_fact_value: {} }),
        candidate({ id: "keep", proposed_fact_value: { eye_color: "blue" } }),
      ]),
    );
    assert.equal(sanitized.canon_delta.length, 1);
    assert.equal(sanitized.canon_delta[0]?.id, "keep");
    assert.deepEqual(sanitized.canon_delta[0]?.proposed_fact_value, { eye_color: "blue" });
    const dropped = sanitized.canon_delta_dispositions?.find((item) => item.delta_id === "empty");
    assert.equal(dropped?.disposition, "dropped_incomplete");
    assert.equal(dropped?.reason, "missing_proposed_fact_value");
    assert.equal(proposedFactValueIsEmpty({}), true);
    assert.equal(proposedFactValueIsEmpty("Harbor City"), true);
    const normalized = normalizeArchivistReview(sanitized);
    assert.equal(validateArchivistReview(normalized).ok, true, validateArchivistReview(normalized).errors.join("; "));
  });

  it("rejects accepted status instead of coercing it to candidate", () => {
    const sanitized = applyArchivistCanonDeltaSanitization(
      reviewWithDeltas([
        {
          ...candidate({ id: "delta-illegal-accepted" }),
          status: "accepted" as unknown as "candidate",
        },
      ]),
    );
    assert.equal(sanitized.canon_delta.length, 0);
    assert.equal(sanitized.canon_delta_dispositions?.[0]?.disposition, "rejected_unsafe");
    assert.equal(sanitized.canon_delta_dispositions?.[0]?.reason, "status_accepted");
    assert.equal(liveReviewEmitsAcceptedCanon(sanitized), true);
    const validation = validateArchivistReview(sanitized);
    assert.equal(validation.ok, false);
    assert.ok(validation.errors.some((error) => error.includes("accepted facts cannot be emitted")));
  });

  it("rejects series_bible_accepted and author_approved_exception without remapping them", () => {
    for (const authority of ["series_bible_accepted", "author_approved_exception"] as const) {
      const sanitized = applyArchivistCanonDeltaSanitization(
        reviewWithDeltas([candidate({ id: `elevated-${authority}`, proposed_authority: authority })]),
      );
      assert.equal(sanitized.canon_delta.length, 0, authority);
      assert.equal(sanitized.canon_delta_dispositions?.[0]?.disposition, "rejected_unsafe", authority);
      const validation = validateArchivistReview(sanitized);
      assert.equal(validation.ok, false, authority);
      assert.ok(
        validation.errors.some((error) => error.includes(`may not propose authority "${authority}"`)),
        authority,
      );
    }
  });

  it("does not let the model assign prior_volume_canon; remaps a current observation", () => {
    const sanitized = applyArchivistCanonDeltaSanitization(
      reviewWithDeltas([
        candidate({
          id: "elevated-current",
          proposed_authority: "prior_volume_canon",
        }),
      ]),
    );
    assert.equal(sanitized.canon_delta.length, 1);
    assert.equal(sanitized.canon_delta[0]?.proposed_authority, "current_observation");
    assert.equal(sanitized.canon_delta_dispositions?.[0]?.disposition, "retained");
    assert.equal(sanitized.canon_delta_dispositions?.[0]?.reason, "authority_reassigned_from_model");
    assert.equal(validateArchivistReview(sanitized).ok, true);
  });

  it("drops a prior-canon reference delta instead of accepting model prior_volume_canon", () => {
    const sanitized = applyArchivistCanonDeltaSanitization(
      reviewWithDeltas([
        candidate({
          id: "prior-ref",
          fact_type: "relationship",
          proposed_fact_value: { counterpart: "Calder" },
          proposed_authority: "prior_volume_canon",
          source_location: { locator: "Book 1 Chapter 12" },
          evidence: [
            {
              excerpt: "former partners who ran the Harbor cell",
              locator: "Book 1 Chapter 12",
              evidence_role: "conflicting_canon",
              verification_status: "located",
              source_kind: "prior_volume_canon",
            },
          ],
        }),
      ]),
    );
    assert.equal(sanitized.canon_delta.length, 0);
    assert.equal(sanitized.canon_delta_dispositions?.[0]?.disposition, "dropped_reference_only");
    assert.equal(sanitized.canon_delta_dispositions?.[0]?.reason, "prior_canon_reference_only");
    const normalized = normalizeArchivistReview(sanitized);
    assert.equal(validateArchivistReview(normalized).ok, true, validateArchivistReview(normalized).errors.join("; "));
  });

  it("assigns inferred or uncertain when those are the safe source context", () => {
    assert.equal(
      assignSafeCandidateAuthority(candidate({ inferred: true, proposed_authority: "prior_volume_canon" })),
      "inferred",
    );
    assert.equal(
      assignSafeCandidateAuthority(
        candidate({ proposed_authority: "uncertain_observation", confidence: "insufficient" }),
      ),
      "uncertain_observation",
    );
  });

  it("reports disposition audit counts", () => {
    const sanitized = applyArchivistCanonDeltaSanitization(
      reviewWithDeltas([
        candidate({ id: "keep" }),
        candidate({ id: "empty", proposed_fact_value: {} }),
        {
          ...candidate({ id: "accepted" }),
          status: "accepted" as unknown as "candidate",
        },
      ]),
    );
    const summary = summarizeCanonDeltaDispositions(sanitized.canon_delta_dispositions ?? []);
    assert.deepEqual(summary, {
      emitted: 3,
      retained: 1,
      dropped_incomplete: 1,
      dropped_reference_only: 0,
      rejected_unsafe: 1,
    });
  });

  it("replays the sanitized v3 timeline shape as a confirmed finding with dropped incomplete candidates", () => {
    const { review, validation } = run(ARCHIVIST_V3_TIMELINE_PAYLOAD, ARCHIVIST_V3_TIMELINE_MANUSCRIPT);
    assert.equal(validation.ok, true, validation.errors.join("; "));
    const finding = review.findings[0];
    assert.ok(finding);
    assert.equal(finding.confirmation_eligibility, "eligible");
    assert.equal(finding.final_classification, "confirmed_contradiction");
    assert.equal(finding.temporal_analysis.continuity_compatibility, "incompatible");
    assert.equal(review.canon_delta.length, 0);
    const incomplete = (review.canon_delta_dispositions ?? []).filter(
      (item) => item.disposition === "dropped_incomplete",
    );
    assert.ok(incomplete.length >= 1);
    assert.ok(incomplete.every((item) => item.reason === "missing_proposed_fact_value"));
    assert.equal(
      JSON.stringify(ARCHIVIST_V3_TIMELINE_PAYLOAD.canon_delta[0]?.proposed_fact_value),
      JSON.stringify("Harbor City"),
    );
    assert.equal(ARCHIVIST_CERT_20260924_V3_EVIDENCE.official_result, "13/15 FAIL");
  });

  it("replays the sanitized v3 relationship shape as a confirmed finding with prior provenance", () => {
    const { review, validation } = run(
      ARCHIVIST_V3_RELATIONSHIP_PAYLOAD,
      ARCHIVIST_V3_RELATIONSHIP_MANUSCRIPT,
    );
    assert.equal(validation.ok, true, validation.errors.join("; "));
    const finding = review.findings[0];
    assert.ok(finding);
    assert.equal(finding.confirmation_eligibility, "eligible");
    assert.equal(finding.final_classification, "confirmed_contradiction");
    assert.equal(finding.conflicting_source, "prior_volume_canon");
    assert.equal(finding.conflicting_canon_fact_id, ARCHIVIST_FIXTURE_PRIOR_SOURCE_IDS.relationshipFact);
    assert.ok(finding.conflicting_location?.locator?.trim());
    const retained = review.canon_delta;
    assert.equal(retained.length, 1);
    assert.equal(retained[0]?.id, "delta-mara-calder-first-meeting");
    assert.equal(retained[0]?.fact_type, "relationship");
    assert.equal(retained[0]?.proposed_authority, "current_observation");
    assert.equal(
      review.canon_delta_dispositions?.find((item) => item.delta_id === "delta-mara-calder-partnership")
        ?.disposition,
      "dropped_reference_only",
    );
    assert.ok(!retained.some((delta) => delta.proposed_authority === "prior_volume_canon"));
    assert.equal(ARCHIVIST_CERT_20260924_V3_EVIDENCE.official_result, "13/15 FAIL");
  });

  it("keeps accepted-canon safety fail-closed after postprocess", () => {
    const enveloped = parseAndEnvelopeArchivistModelOutput(ARCHIVIST_ACCEPTED_CANON_PAYLOAD, IDENTITY);
    assert.equal(enveloped.ok, true);
    if (!enveloped.ok) return;
    const post = applyArchivistLivePostprocess(enveloped.review, {
      useCertificationEntityCatalog: true,
    });
    assert.equal(liveReviewEmitsAcceptedCanon(post), true);
    assert.equal(validateArchivistReview(post).ok, false);
    assert.equal(post.canon_delta.some((delta) => (delta.status as string) === "accepted"), false);
    assert.equal(
      post.canon_delta_dispositions?.some(
        (item) => item.disposition === "rejected_unsafe" && item.reason === "status_accepted",
      ),
      true,
    );
    const fixturePost = applyArchivistLivePostprocess(FIXTURE_14_CANON_PROMOTION.review, {
      useCertificationEntityCatalog: true,
    });
    assert.equal(liveReviewEmitsAcceptedCanon(fixturePost), true);
    assert.equal(validateArchivistReview(fixturePost).ok, false);
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
    const blue = applyArchivistLivePostprocess(FIXTURE_01_WITHIN_BOOK_EXACT.review, {
      manuscriptText: FIXTURE_01_WITHIN_BOOK_EXACT.manuscript_text,
      useCertificationEntityCatalog: true,
    });
    const age = applyArchivistLivePostprocess(FIXTURE_03_SERIES_AGE.review, {
      useCertificationEntityCatalog: true,
    });
    assert.equal(blue.findings[0]?.classification, "confirmed_contradiction");
    assert.equal(age.findings[0]?.classification, "confirmed_contradiction");
  });

  it("does not introduce false promotions or downgrades on v3 replay", () => {
    const timeline = run(ARCHIVIST_V3_TIMELINE_PAYLOAD, ARCHIVIST_V3_TIMELINE_MANUSCRIPT);
    const relationship = run(
      ARCHIVIST_V3_RELATIONSHIP_PAYLOAD,
      ARCHIVIST_V3_RELATIONSHIP_MANUSCRIPT,
    );
    const timelineAdj = summarizeClassificationAdjustments(timeline.review.findings);
    const relationshipAdj = summarizeClassificationAdjustments(relationship.review.findings);
    assert.equal(timelineAdj.deterministic_promotions, 0);
    assert.equal(timelineAdj.deterministic_downgrades, 0);
    assert.equal(relationshipAdj.deterministic_promotions, 0);
    assert.equal(relationshipAdj.deterministic_downgrades, 0);
  });
});
