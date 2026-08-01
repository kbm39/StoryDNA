import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EDITORIAL_UNDERSTANDING_CONTRACT_VERSION,
  EDITORIAL_UNDERSTANDING_IS_AUTHOR_INTENT,
  EDITORIAL_UNDERSTANDING_IS_CANON,
  EDITORIAL_UNDERSTANDING_IS_EVIDENCE,
  EDITORIAL_UNDERSTANDING_STATUSES,
} from "./contract.ts";
import {
  assertUnderstandingContractVersion,
  buildUnderstandingSummary,
  confirmedUnderstandingIsImmutable,
  understandingMetadataFlags,
  validateEditorialUnderstandingDraft,
} from "./validation.ts";

describe("storydna_editorial_understanding@v1 contract", () => {
  it("1. contract version is storydna_editorial_understanding@v1", () => {
    assert.equal(EDITORIAL_UNDERSTANDING_CONTRACT_VERSION, "storydna_editorial_understanding@v1");
    assert.equal(assertUnderstandingContractVersion(EDITORIAL_UNDERSTANDING_CONTRACT_VERSION), true);
  });

  it("2. statuses include draft through cancelled per Phase 1B-ab", () => {
    for (const status of [
      "draft",
      "awaiting_author_confirmation",
      "confirmed",
      "correction_requested",
      "superseded",
      "cancelled",
    ]) {
      assert.ok((EDITORIAL_UNDERSTANDING_STATUSES as readonly string[]).includes(status));
    }
  });

  it("3. metadata flags are never evidence, intent, or canon", () => {
    const flags = understandingMetadataFlags();
    assert.equal(flags.is_manuscript_evidence, false);
    assert.equal(flags.is_author_intent, false);
    assert.equal(flags.is_canon, false);
    assert.equal(EDITORIAL_UNDERSTANDING_IS_EVIDENCE, false);
    assert.equal(EDITORIAL_UNDERSTANDING_IS_AUTHOR_INTENT, false);
    assert.equal(EDITORIAL_UNDERSTANDING_IS_CANON, false);
  });

  it("4. confirmed understanding is immutable", () => {
    assert.equal(confirmedUnderstandingIsImmutable("confirmed"), true);
    assert.equal(confirmedUnderstandingIsImmutable("draft"), false);
  });

  it("5. draft validation requires manuscript and creator", () => {
    const result = validateEditorialUnderstandingDraft({
      book_id: "",
      manuscript_id: "",
      manuscript_version_id: "",
      created_by: "",
    });
    assert.equal(result.ok, false);
  });

  it("6. understanding summary ends with confirmation question", () => {
    const summary = buildUnderstandingSummary({
      understanding_id: "u1",
      book_id: "b1",
      manuscript_id: "b1",
      manuscript_version_id: "v1",
      contract_version: EDITORIAL_UNDERSTANDING_CONTRACT_VERSION,
      interview_type: "eic_author_intake",
      conducted_by: "editor_in_chief",
      primary_vision: "A war story",
      target_reader: "Military thriller readers",
      desired_reader_experience: null,
      market_position: "Commercial fiction",
      creative_motivation: "Personal service",
      success_definition: "Query-ready",
      comparison_titles: null,
      open_questions: [],
      confidence: {
        overall: 0.75,
        by_field: {
          primary_vision: 0.75,
          target_reader: 0.75,
          desired_reader_experience: null,
          market_position: 0.75,
          creative_motivation: 0.75,
          success_definition: 0.75,
        },
        confirmed_at: null,
        confirmed_by: null,
      },
      resolved_clarifications: [],
      conversation_history: [],
      stage_turns: [],
      understanding_summary: null,
      version: 1,
      status: "awaiting_author_confirmation",
      is_manuscript_evidence: false,
      is_author_intent: false,
      is_canon: false,
      created_by: "studio-author",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      confirmed_at: null,
      confirmed_by: null,
      supersedes_understanding_id: null,
      superseded_at: null,
      provider_model: "deterministic@v1",
      provider_cost_usd: 0,
      understanding_quality: null,
      synthesis_artifacts: [],
    });
    assert.match(summary, /Did I understand you correctly\?/);
    assert.match(summary, /Your story: A war story/);
  });
});
