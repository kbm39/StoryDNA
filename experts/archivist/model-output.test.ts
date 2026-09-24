import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyArchivistSystemOwnedFields,
  ARCHIVIST_MODEL_OUTPUT_KEYS,
  ARCHIVIST_SYSTEM_OWNED_REVIEW_KEYS,
  extractArchivistJson,
  parseAndEnvelopeArchivistModelOutput,
} from "./model-output.ts";
import { applyArchivistLivePostprocess, liveReviewEmitsAcceptedCanon } from "./live-postprocess.ts";
import { validateArchivistReview } from "./validation.ts";
import {
  ARCHIVIST_ACCEPTED_CANON_PAYLOAD,
  ARCHIVIST_FENCED_CLEAN_JSON,
  ARCHIVIST_MODEL_PAYLOAD_BLUE_GREEN,
  ARCHIVIST_MODEL_PAYLOAD_CLEAN,
  ARCHIVIST_NOT_JSON,
  ARCHIVIST_ONE_SIDED_CONFIRMED_PAYLOAD,
  ARCHIVIST_PROSE_WRAPPED_CLEAN_JSON,
  ARCHIVIST_TRUNCATED_JSON,
} from "./structured-output-failure-fixtures.ts";
import { FIXTURE_CONTENT_HASH, FIXTURE_MANUSCRIPT_ID, FIXTURE_MANUSCRIPT_VERSION_ID } from "./fixtures.ts";
import { ARCHIVIST_LIVE_MODEL_CERTIFIED } from "./live-flags.ts";
import { ARCHIVIST_SMOKE_20260922_V1_EVIDENCE } from "./session-archivist-smoke-20260922-v1.ts";
import { ARCHIVIST_SMOKE_20260922_V2_EVIDENCE } from "./session-archivist-smoke-20260922-v2.ts";
import { ARCHIVIST_ANTHROPIC_STRUCTURED_OUTPUT_CAPABILITY } from "./native-structured-output.ts";
import { getLiveProviderInvocationCount, resetLiveProviderInvocationCountForTests } from "@/lib/execute-expert/dry-run-guard.ts";
import { completeArchivistStructuredOutput } from "./live-structured-output.ts";
import { createMockArchivistLiveProvider } from "./live-provider.ts";
import { createExpertCostLedger } from "@/lib/execute-expert/cost.ts";

const IDENTITY = {
  manuscript_id: FIXTURE_MANUSCRIPT_ID,
  manuscript_version_id: FIXTURE_MANUSCRIPT_VERSION_ID,
  content_hash: FIXTURE_CONTENT_HASH,
};

describe("Archivist model-facing output + envelope", () => {
  it("classifies and recovers fenced and prose-wrapped JSON without a provider", () => {
    resetLiveProviderInvocationCountForTests();
    const fenced = extractArchivistJson(ARCHIVIST_FENCED_CLEAN_JSON);
    assert.equal(fenced.ok, true);
    assert.equal(fenced.method, "fenced");
    const prose = extractArchivistJson(ARCHIVIST_PROSE_WRAPPED_CLEAN_JSON);
    assert.equal(prose.ok, true);
    assert.equal(prose.method, "isolated");
    assert.equal(extractArchivistJson(ARCHIVIST_NOT_JSON).failure_class, "not_json");
    assert.equal(extractArchivistJson(ARCHIVIST_TRUNCATED_JSON).failure_class, "truncated_json");
    assert.equal(getLiveProviderInvocationCount(), 0);
  });

  it("injects system-owned fields and derives metrics", () => {
    const enveloped = parseAndEnvelopeArchivistModelOutput(ARCHIVIST_MODEL_PAYLOAD_CLEAN, IDENTITY);
    assert.equal(enveloped.ok, true);
    if (!enveloped.ok) return;
    assert.equal(enveloped.review.schema, "archivist_review@v1");
    assert.equal(enveloped.review.manuscript_id, FIXTURE_MANUSCRIPT_ID);
    assert.equal(enveloped.review.content_hash, FIXTURE_CONTENT_HASH);
    assert.equal(enveloped.review.author_challenge_supported, true);
    assert.equal(enveloped.review.generation.provider, "none");
    assert.equal(enveloped.review.metrics.finding_count, 0);
    const validated = validateArchivistReview(enveloped.review);
    assert.equal(validated.ok, true, validated.errors.join("; "));
    assert.ok(ARCHIVIST_SYSTEM_OWNED_REVIEW_KEYS.includes("manuscript_id"));
    assert.ok(ARCHIVIST_MODEL_OUTPUT_KEYS.includes("findings"));
  });

  it("keeps both-side confirmed contradictions and fail-closes accepted canon", () => {
    const confirmed = parseAndEnvelopeArchivistModelOutput(
      ARCHIVIST_MODEL_PAYLOAD_BLUE_GREEN,
      IDENTITY,
    );
    assert.equal(confirmed.ok, true);
    if (!confirmed.ok) return;
    const post = applyArchivistLivePostprocess(confirmed.review, {
      manuscriptText:
        "Chapter 3. Mara had blue eyes that caught the lantern light.\nChapter 22. Mara's green eyes narrowed at the map.",
      useCertificationEntityCatalog: true,
    });
    assert.equal(
      post.findings.filter((finding) => finding.classification === "confirmed_contradiction").length,
      1,
    );

    const accepted = parseAndEnvelopeArchivistModelOutput(ARCHIVIST_ACCEPTED_CANON_PAYLOAD, IDENTITY);
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    assert.equal(liveReviewEmitsAcceptedCanon(accepted.review), true);

    const oneSided = parseAndEnvelopeArchivistModelOutput(
      ARCHIVIST_ONE_SIDED_CONFIRMED_PAYLOAD,
      IDENTITY,
    );
    assert.equal(oneSided.ok, true);
    if (!oneSided.ok) return;
    const downgraded = applyArchivistLivePostprocess(oneSided.review);
    assert.equal(
      downgraded.findings.filter((finding) => finding.classification === "confirmed_contradiction")
        .length,
      0,
    );
  });

  it("recovers fenced model JSON through structured-output without a repair call", async () => {
    resetLiveProviderInvocationCountForTests();
    const ledger = createExpertCostLedger({ expertKey: "archivist", mode: "live" });
    const result = await completeArchivistStructuredOutput({
      provider: createMockArchivistLiveProvider({
        complete: async () => ({ content: ARCHIVIST_FENCED_CLEAN_JSON }),
      }),
      system: "system",
      user: "user",
      ledger,
      allowRepair: false,
    });
    assert.equal(result.ok, true);
    assert.equal(result.repair_invoked, false);
    assert.equal(getLiveProviderInvocationCount(), 1);
    if (result.ok) {
      const wrapped = applyArchivistSystemOwnedFields(result.review, IDENTITY);
      assert.equal(validateArchivistReview(wrapped).ok, true);
    }
  });

  it("records the failed session evidence gap and keeps gates closed", () => {
    assert.equal(ARCHIVIST_LIVE_MODEL_CERTIFIED, false);
    assert.equal(
      ARCHIVIST_SMOKE_20260922_V1_EVIDENCE.cases.every((item) => item.raw_primary_preserved === false),
      true,
    );
    assert.equal(ARCHIVIST_SMOKE_20260922_V1_EVIDENCE.cost_accounting.complete, false);
    assert.equal(ARCHIVIST_ANTHROPIC_STRUCTURED_OUTPUT_CAPABILITY.adopt_native_now, false);
    assert.equal(
      ARCHIVIST_SMOKE_20260922_V1_EVIDENCE.blue_green_contradiction_detected_by_haiku,
      "unknown_raw_output_not_preserved",
    );
    assert.equal(ARCHIVIST_SMOKE_20260922_V2_EVIDENCE.not_a_pass, true);
    assert.equal(ARCHIVIST_SMOKE_20260922_V2_EVIDENCE.official_result, "0/3 failed certification");
  });
});
