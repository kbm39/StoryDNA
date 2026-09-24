import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ARCHIVIST_FIXTURE_ENTITY_IDS } from "./entity-catalog.ts";
import { applyArchivistLivePostprocess, liveReviewEmitsAcceptedCanon } from "./live-postprocess.ts";
import { parseAndEnvelopeArchivistModelOutput } from "./model-output.ts";
import { validateArchivistReview } from "./validation.ts";
import { FIXTURE_CONTENT_HASH, FIXTURE_MANUSCRIPT_ID, FIXTURE_MANUSCRIPT_VERSION_ID } from "./fixtures.ts";
import { ARCHIVIST_SMOKE_20260922_V2_EVIDENCE } from "./session-archivist-smoke-20260922-v2.ts";
import { ARCHIVIST_ACCEPTED_CANON_PAYLOAD, ARCHIVIST_ONE_SIDED_CONFIRMED_PAYLOAD } from "./structured-output-failure-fixtures.ts";
import {
  ARCHIVIST_V2_AMBIGUOUS_JOHN_PAYLOAD,
  ARCHIVIST_V2_BLUE_GREEN_FENCED,
  ARCHIVIST_V2_CLEAN_CONTROL_PAYLOAD,
  ARCHIVIST_V2_EXPLAINED_DYE_PAYLOAD,
  ARCHIVIST_V2_SPOOFED_ENTITY_ID_PAYLOAD,
  ARCHIVIST_V2_UNKNOWN_ENTITY_PAYLOAD,
  ARCHIVIST_V3_BLUE_GREEN_MANUSCRIPT,
  ARCHIVIST_V3_CLEAN_MANUSCRIPT,
  ARCHIVIST_V3_DYE_MANUSCRIPT,
} from "./v2-regression-fixtures.ts";
import { ARCHIVIST_LIVE_MODEL_CERTIFIED } from "./live-flags.ts";
import {
  ARCHIVIST_SMOKE_20260922_V3_SESSION_ID,
  ARCHIVIST_V3_AUTHORIZED,
} from "./v3-certification-criteria.ts";

const IDENTITY = {
  manuscript_id: FIXTURE_MANUSCRIPT_ID,
  manuscript_version_id: FIXTURE_MANUSCRIPT_VERSION_ID,
  content_hash: FIXTURE_CONTENT_HASH,
};

function runSemantics(raw: unknown, manuscript: string) {
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

describe("Archivist v2 regression fixtures after StoryDNA semantics", () => {
  it("preserves v2 as an official failed certification", () => {
    assert.equal(ARCHIVIST_SMOKE_20260922_V2_EVIDENCE.official_result, "0/3 failed certification");
    assert.equal(ARCHIVIST_SMOKE_20260922_V2_EVIDENCE.not_a_pass, true);
    assert.equal(ARCHIVIST_SMOKE_20260922_V2_EVIDENCE.session_id, "archivist-smoke-20260922-v2");
    assert.notEqual(ARCHIVIST_SMOKE_20260922_V2_EVIDENCE.session_id, ARCHIVIST_SMOKE_20260922_V3_SESSION_ID);
    assert.equal(ARCHIVIST_V3_AUTHORIZED, false);
    assert.equal(ARCHIVIST_LIVE_MODEL_CERTIFIED, false);
  });

  it("keeps the blue/green confirmed contradiction after fenced extract", () => {
    const { review, validation } = runSemantics(
      ARCHIVIST_V2_BLUE_GREEN_FENCED,
      ARCHIVIST_V3_BLUE_GREEN_MANUSCRIPT,
    );
    assert.equal(validation.ok, true, validation.errors.join("; "));
    assert.equal(
      review.findings.filter((finding) => finding.classification === "confirmed_contradiction").length,
      1,
    );
    assert.equal(review.findings[0]?.temporal_analysis.relation, "earlier_later");
    assert.equal(review.findings[0]?.temporal_analysis.continuity_compatibility, "incompatible");
    assert.equal(review.canon_delta[0]?.entity.entity_id, ARCHIVIST_FIXTURE_ENTITY_IDS.mara);
    assert.equal(review.canon_delta[0]?.status, "candidate");
  });

  it("does not confirm the explained dye change", () => {
    const { review, validation } = runSemantics(
      ARCHIVIST_V2_EXPLAINED_DYE_PAYLOAD,
      ARCHIVIST_V3_DYE_MANUSCRIPT,
    );
    assert.equal(validation.ok, true, validation.errors.join("; "));
    assert.equal(
      review.findings.filter((finding) => finding.classification === "confirmed_contradiction").length,
      0,
    );
    assert.equal(review.findings[0]?.temporal_analysis.relation, "earlier_later");
    assert.equal(review.findings[0]?.temporal_analysis.continuity_compatibility, "compatible_change");
  });

  it("cleans the false-positive control without confirming or keeping fake ambiguity", () => {
    const { review, validation } = runSemantics(
      ARCHIVIST_V2_CLEAN_CONTROL_PAYLOAD,
      ARCHIVIST_V3_CLEAN_MANUSCRIPT,
    );
    assert.equal(validation.ok, true, validation.errors.join("; "));
    assert.equal(
      review.findings.filter((finding) => finding.classification === "confirmed_contradiction").length,
      0,
    );
    assert.equal(
      review.findings.filter((finding) => finding.classification === "author_verification_needed").length,
      0,
    );
    assert.equal(review.entity_ambiguities.length, 0);
    assert.equal(review.canon_delta[0]?.entity.entity_id, ARCHIVIST_FIXTURE_ENTITY_IDS.mara);
  });

  it("attaches a StoryDNA ID when the model omitted or spoofed one", () => {
    const { review, validation } = runSemantics(
      ARCHIVIST_V2_SPOOFED_ENTITY_ID_PAYLOAD,
      ARCHIVIST_V3_BLUE_GREEN_MANUSCRIPT,
    );
    assert.equal(validation.ok, true, validation.errors.join("; "));
    assert.equal(review.canon_delta[0]?.entity.entity_id, ARCHIVIST_FIXTURE_ENTITY_IDS.mara);
    assert.notEqual(review.canon_delta[0]?.entity.entity_id, "spoofed-not-a-storydna-id");
  });

  it("supplies real candidates for an ambiguous alias", () => {
    const { review, validation } = runSemantics(ARCHIVIST_V2_AMBIGUOUS_JOHN_PAYLOAD, "Chapter 8. John closed the ledger.");
    assert.equal(validation.ok, true, validation.errors.join("; "));
    assert.equal(review.canon_delta[0]?.entity.resolution, "ambiguous");
    assert.equal(review.entity_ambiguities[0]?.candidate_entities.length, 2);
  });

  it("does not fabricate IDs or candidates when nothing matches", () => {
    const { review, validation } = runSemantics(
      ARCHIVIST_V2_UNKNOWN_ENTITY_PAYLOAD,
      "Chapter 1. Nobody stood at the rail.",
    );
    assert.equal(validation.ok, true, validation.errors.join("; "));
    assert.equal(review.canon_delta[0]?.entity.resolution, "not_found");
    assert.equal(review.canon_delta[0]?.entity.entity_id, undefined);
    assert.equal(review.entity_ambiguities.length, 0);
  });

  it("keeps accepted-canon and one-sided-confirm safety failures", () => {
    const accepted = parseAndEnvelopeArchivistModelOutput(ARCHIVIST_ACCEPTED_CANON_PAYLOAD, IDENTITY);
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    const acceptedPost = applyArchivistLivePostprocess(accepted.review, {
      useCertificationEntityCatalog: true,
    });
    assert.equal(liveReviewEmitsAcceptedCanon(acceptedPost), true);
    assert.equal(validateArchivistReview(acceptedPost).ok, false);

    const oneSided = runSemantics(
      ARCHIVIST_ONE_SIDED_CONFIRMED_PAYLOAD,
      ARCHIVIST_V3_BLUE_GREEN_MANUSCRIPT,
    );
    assert.equal(
      oneSided.review.findings.filter((finding) => finding.classification === "confirmed_contradiction")
        .length,
      0,
    );
  });
});
