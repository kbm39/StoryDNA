import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runArchivistDraftCertification, ARCHIVIST_CERTIFICATION_GATES } from "./certification.ts";
import { ARCHIVIST_CERTIFICATION_FIXTURES } from "./fixtures.ts";
import { normalizeArchivistReview } from "./normalization.ts";
import { validateArchivistReview } from "./validation.ts";
import { confirmedContradictionHasBothSides } from "./evidence.ts";
import { ARCHIVIST_CERTIFICATION_STATUS } from "./contracts.ts";

describe("Archivist certification fixtures and gates", () => {
  it("includes the fifteen mandatory fixtures", () => {
    assert.equal(ARCHIVIST_CERTIFICATION_FIXTURES.length, 15);
    assert.deepEqual(
      ARCHIVIST_CERTIFICATION_FIXTURES.map((fixture) => fixture.id),
      [
        "within_book_exact_contradiction",
        "explained_apparent_conflict",
        "series_age_contradiction",
        "timeline_contradiction",
        "injury_continuity",
        "knowledge_state",
        "relationship_history",
        "object_possession",
        "alive_dead_temporal_control",
        "intentional_retcon",
        "ambiguous_alias",
        "uncertain_evidence",
        "no_false_positive_control",
        "canon_promotion_safety",
        "missing_conflict_evidence",
      ],
    );
  });

  it("evaluates each fixture against its expected validation outcome", () => {
    for (const fixture of ARCHIVIST_CERTIFICATION_FIXTURES) {
      const normalized = normalizeArchivistReview(fixture.review);
      const result = validateArchivistReview(normalized, {
        manuscriptText: fixture.manuscript_text,
      });
      assert.equal(
        result.ok,
        fixture.expect.validation_ok,
        `${fixture.id}: ${result.errors.join("; ")}`,
      );
      if (result.ok) {
        assert.equal(
          normalized.metrics.confirmed_contradiction_count,
          fixture.expect.confirmed_count,
          fixture.id,
        );
      }
    }
  });

  it("valid confirmed findings always have both-side evidence", () => {
    for (const fixture of ARCHIVIST_CERTIFICATION_FIXTURES) {
      if (!fixture.expect.validation_ok) continue;
      const review = normalizeArchivistReview(fixture.review);
      for (const finding of review.findings) {
        if (finding.classification !== "confirmed_contradiction") continue;
        assert.equal(confirmedContradictionHasBothSides(finding), true, fixture.id);
      }
    }
  });

  it("passes mandatory gates while remaining draft_not_certified", async () => {
    const report = await runArchivistDraftCertification();
    assert.deepEqual(
      report.gates.map((gate) => gate.gate),
      [...ARCHIVIST_CERTIFICATION_GATES],
    );
    assert.equal(report.mandatory_gates_passed, true, report.errors.join("\n"));
    assert.equal(report.certification_status, ARCHIVIST_CERTIFICATION_STATUS);
    assert.equal(report.live_model_certified, false);
    assert.equal(report.definition_validation_ok, true);
    assert.equal(report.runtime_validation_ok, true);
    assert.equal(report.module_refs_ok, true);
    assert.equal(report.literary_agent_runtime_hash_unchanged, true);
  });
});
