import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCanonStore } from "@/lib/canon/memory.ts";
import { applyArchivistLivePostprocess } from "./live-postprocess.ts";
import { parseAndEnvelopeArchivistModelOutput } from "./model-output.ts";
import { validateArchivistReview } from "./validation.ts";
import { evaluateConfirmationEligibility } from "./confirmation-eligibility.ts";
import { ARCHIVIST_CERTIFICATION_ENTITY_CATALOG } from "./entity-catalog.ts";
import {
  ARCHIVIST_FIXTURE_PRIOR_SOURCE_IDS,
  ARCHIVIST_CERTIFICATION_PRIOR_SOURCES,
} from "./prior-source-catalog.ts";
import {
  applyPriorCanonProvenance,
  hasPriorCanonLocator,
  hasPriorCanonSourceIdentity,
  mapIssueTypeToFactType,
} from "./prior-canon-provenance.ts";
import {
  ARCHIVIST_V2_RELATIONSHIP_MANUSCRIPT,
  ARCHIVIST_V2_RELATIONSHIP_PAYLOAD,
} from "./v2-cert-regression-fixtures.ts";
import {
  FIXTURE_CONTENT_HASH,
  FIXTURE_MANUSCRIPT_ID,
  FIXTURE_MANUSCRIPT_VERSION_ID,
  FIXTURE_07_RELATIONSHIP,
} from "./fixtures.ts";
import { ARCHIVIST_CERT_20260924_V2_EVIDENCE } from "./session-archivist-cert-20260924-v2.ts";
import type { ArchivistFinding } from "./contracts.ts";

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

function relationshipFinding(overrides: Partial<ArchivistFinding> = {}): ArchivistFinding {
  return {
    ...FIXTURE_07_RELATIONSHIP.review.findings[0]!,
    ...overrides,
  };
}

describe("Archivist prior-canon provenance", () => {
  it("records the exact v2 relationship validator mismatch", () => {
    assert.equal(
      ARCHIVIST_CERT_20260924_V2_EVIDENCE.validation_error,
      'canon_delta[0]: unsupported fact type "prior_event_reference"',
    );
    assert.equal(mapIssueTypeToFactType("prior_event_reference"), "relationship");
  });

  it("attaches fixture provenance and validates the sanitized v2 relationship shape", () => {
    const { review, validation } = run(
      ARCHIVIST_V2_RELATIONSHIP_PAYLOAD,
      ARCHIVIST_V2_RELATIONSHIP_MANUSCRIPT,
    );
    assert.equal(validation.ok, true, validation.errors.join("; "));
    const finding = review.findings[0];
    assert.ok(finding);
    assert.equal(finding.confirmation_eligibility, "eligible");
    assert.equal(finding.final_classification, "confirmed_contradiction");
    assert.equal(finding.conflicting_source, "prior_volume_canon");
    assert.equal(finding.conflicting_canon_fact_id, ARCHIVIST_FIXTURE_PRIOR_SOURCE_IDS.relationshipFact);
    assert.ok(finding.conflicting_location?.locator?.trim());
    assert.equal(review.canon_delta[0]?.fact_type, "relationship");
    assert.equal(review.canon_delta[0]?.entity.resolution, "resolved");
    const prior = finding.conflicting_evidence[0];
    assert.equal(prior?.manuscript_id, ARCHIVIST_FIXTURE_PRIOR_SOURCE_IDS.book1Manuscript);
    assert.equal(prior?.manuscript_version_id, ARCHIVIST_FIXTURE_PRIOR_SOURCE_IDS.book1Version);
    assert.equal(prior?.canon_fact_id, ARCHIVIST_FIXTURE_PRIOR_SOURCE_IDS.relationshipFact);
    assert.ok(hasPriorCanonLocator(finding));
    assert.ok(hasPriorCanonSourceIdentity(finding));
  });

  it("downgrades a missing prior locator and never confirms it", () => {
    const finding = relationshipFinding({
      conflicting_location: { locator: "", chapter: "12" },
      conflicting_evidence: [
        {
          ...FIXTURE_07_RELATIONSHIP.review.findings[0]!.conflicting_evidence[0]!,
          locator: "",
        },
      ],
    });
    const eligibility = evaluateConfirmationEligibility(finding, {
      entityContext: { catalog: ARCHIVIST_CERTIFICATION_ENTITY_CATALOG },
    });
    assert.notEqual(eligibility.final_classification, "confirmed_contradiction");
    assert.ok(eligibility.failed_gates.includes("missing_prior_locator"));
  });

  it("downgrades missing prior source identity", () => {
    const finding = relationshipFinding({
      conflicting_canon_fact_id: undefined,
      conflicting_source: "prior_volume_canon",
      conflicting_evidence: [
        {
          excerpt: "former partners who ran the Harbor cell",
          locator: "Book 1 Chapter 12",
          evidence_role: "conflicting_canon",
          verification_status: "located",
          source_kind: "prior_volume_canon",
        },
      ],
    });
    const eligibility = evaluateConfirmationEligibility(finding, {
      entityContext: { catalog: ARCHIVIST_CERTIFICATION_ENTITY_CATALOG },
    });
    assert.notEqual(eligibility.final_classification, "confirmed_contradiction");
    assert.ok(eligibility.failed_gates.includes("missing_prior_source_identity"));
  });

  it("ignores a fabricated model source ID and keeps the fixture source", () => {
    const enveloped = parseAndEnvelopeArchivistModelOutput(
      {
        ...ARCHIVIST_V2_RELATIONSHIP_PAYLOAD,
        findings: [
          {
            ...ARCHIVIST_V2_RELATIONSHIP_PAYLOAD.findings[0],
            conflicting_evidence: [
              {
                ...ARCHIVIST_V2_RELATIONSHIP_PAYLOAD.findings[0].conflicting_evidence[0],
                manuscript_id: "prod-82d9a62b-hold-fast-fake",
                manuscript_version_id: "prod-version-fake",
                canon_fact_id: "prod-invented-fact",
              },
            ],
          },
        ],
      },
      IDENTITY,
    );
    assert.equal(enveloped.ok, true);
    if (!enveloped.ok) return;
    const review = applyPriorCanonProvenance(enveloped.review, {
      priorSources: ARCHIVIST_CERTIFICATION_PRIOR_SOURCES,
      currentManuscriptId: IDENTITY.manuscript_id,
    });
    const prior = review.findings[0]?.conflicting_evidence[0];
    assert.notEqual(prior?.manuscript_id, "prod-82d9a62b-hold-fast-fake");
    assert.equal(prior?.manuscript_id, ARCHIVIST_FIXTURE_PRIOR_SOURCE_IDS.book1Manuscript);
    assert.equal(prior?.canon_fact_id, ARCHIVIST_FIXTURE_PRIOR_SOURCE_IDS.relationshipFact);
  });

  it("lets a canon-store source win over the fixture registry", () => {
    const store = createCanonStore();
    store.facts.push({
      id: "canon-fact-rel-mara-calder",
      series_id: "series-archivist-cert-20260924",
      entity_id: "fixture-entity-mara",
      fact_type: "relationship",
      fact_value: { counterpart: "Calder", history: "former partners who ran the Harbor cell" },
      temporal_scope: { kind: "from_to", book_order: 1, from: "8", to: "12" },
      source_manuscript_id: "ms-book-1",
      source_version_id: "mv-book-1",
      source_content_hash: ARCHIVIST_FIXTURE_PRIOR_SOURCE_IDS.book1Hash,
      locator: "Book 1 Chapter 12",
      confidence: "high",
      authority: "prior_volume_canon",
      status: "accepted",
      superseded_by_fact_id: null,
      created_by: "author",
      created_at: "2026-09-24T00:00:00.000Z",
      updated_at: "2026-09-24T00:00:00.000Z",
    });
    const enveloped = parseAndEnvelopeArchivistModelOutput(
      ARCHIVIST_V2_RELATIONSHIP_PAYLOAD,
      IDENTITY,
    );
    assert.equal(enveloped.ok, true);
    if (!enveloped.ok) return;
    const review = applyPriorCanonProvenance(enveloped.review, {
      canonStore: store,
      priorSources: ARCHIVIST_CERTIFICATION_PRIOR_SOURCES,
    });
    const prior = review.findings[0]?.conflicting_evidence[0];
    assert.equal(prior?.manuscript_id, "ms-book-1");
    assert.equal(prior?.manuscript_version_id, "mv-book-1");
    assert.equal(review.findings[0]?.conflicting_canon_fact_id, "canon-fact-rel-mara-calder");
  });
});
