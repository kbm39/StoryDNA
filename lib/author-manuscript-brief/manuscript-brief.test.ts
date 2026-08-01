import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INTAKE_PROMPT_COUNT,
  MANUSCRIPT_BRIEF_CONTRACT_VERSION,
  MANUSCRIPT_BRIEF_IS_EVIDENCE,
  MANUSCRIPT_BRIEF_STATUSES,
  MARKET_POSITION_UNSURE,
} from "./contract.ts";
import {
  STUDIO_EIC_CONVERSATIONAL_INTAKE_FLAG_NAME,
  isStudioEicConversationalIntakeEnabled,
  isStudioEicConversationalIntakeFlagSet,
} from "./feature-flag.ts";
import {
  STUDIO_AUTHOR_INTENT_FLAG_NAME,
} from "@/lib/author-intent/feature-flag.ts";
import { STUDIO_EIC_FLAG_NAME } from "@/lib/eic/feature-flag.ts";
import {
  assertBriefContractVersion,
  briefIsManuscriptEvidence,
  isValidBriefStatus,
  normalizeMarketPosition,
  validateManuscriptBriefDraft,
  validateManuscriptBriefSubmit,
} from "./validation.ts";

const BASE = {
  book_id: "book-1",
  manuscript_id: "book-1",
  manuscript_version_id: "ver-1",
  created_by: "author-1",
};

describe("manuscript brief contract", () => {
  it("uses storydna_author_manuscript_brief@v1", () => {
    assert.equal(MANUSCRIPT_BRIEF_CONTRACT_VERSION, "storydna_author_manuscript_brief@v1");
    assert.equal(assertBriefContractVersion(MANUSCRIPT_BRIEF_CONTRACT_VERSION), true);
  });

  it("allows valid statuses only", () => {
    for (const status of MANUSCRIPT_BRIEF_STATUSES) {
      assert.equal(isValidBriefStatus(status), true);
    }
    assert.equal(isValidBriefStatus("active"), false);
  });

  it("brief is never manuscript evidence", () => {
    assert.equal(MANUSCRIPT_BRIEF_IS_EVIDENCE, false);
    assert.equal(briefIsManuscriptEvidence(), false);
  });

  it("defines six intake prompts", () => {
    assert.equal(INTAKE_PROMPT_COUNT, 6);
  });
});

describe("manuscript brief validation", () => {
  it("requires elevator pitch before submission", () => {
    const short = validateManuscriptBriefSubmit({ elevator_pitch: "Too short" });
    assert.equal(short.ok, false);
    assert.match(short.errors[0].code, /elevator_pitch_required/);

    const empty = validateManuscriptBriefSubmit({ elevator_pitch: "" });
    assert.equal(empty.ok, false);

    const valid = validateManuscriptBriefSubmit({
      elevator_pitch: "A war novel about loyalty and betrayal on the home front.",
    });
    assert.equal(valid.ok, true);
  });

  it("allows optional fields to be empty on submit", () => {
    const result = validateManuscriptBriefSubmit({
      elevator_pitch: "A literary thriller set in coastal Maine.",
      desired_reader_experience: null,
      comparison_titles: null,
      success_definition: null,
    });
    assert.equal(result.ok, true);
  });

  it("normalizes market position unsure", () => {
    assert.equal(normalizeMarketPosition(""), MARKET_POSITION_UNSURE);
    assert.equal(normalizeMarketPosition("I'm not sure"), MARKET_POSITION_UNSURE);
    assert.equal(normalizeMarketPosition("unsure"), MARKET_POSITION_UNSURE);
    assert.equal(normalizeMarketPosition("Commercial thriller"), "Commercial thriller");
  });

  it("validates draft input requires ids and creator", () => {
    const missing = validateManuscriptBriefDraft({
      ...BASE,
      manuscript_id: "",
    });
    assert.equal(missing.ok, false);
    assert.match(missing.errors[0].code, /missing_manuscript_id/);

    const valid = validateManuscriptBriefDraft(BASE);
    assert.equal(valid.ok, true);
  });
});

describe("conversational intake feature flag", () => {
  const saved = {
    intake: process.env[STUDIO_EIC_CONVERSATIONAL_INTAKE_FLAG_NAME],
    author: process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME],
    eic: process.env[STUDIO_EIC_FLAG_NAME],
    studio: process.env.STUDIO_ENABLED,
    nodeEnv: process.env.NODE_ENV,
  };

  function restore() {
    for (const [key, val] of Object.entries(saved)) {
      const envKey =
        key === "intake"
          ? STUDIO_EIC_CONVERSATIONAL_INTAKE_FLAG_NAME
          : key === "author"
            ? STUDIO_AUTHOR_INTENT_FLAG_NAME
            : key === "eic"
              ? STUDIO_EIC_FLAG_NAME
              : key === "studio"
                ? "STUDIO_ENABLED"
                : "NODE_ENV";
      if (val === undefined) delete process.env[envKey];
      else process.env[envKey] = val;
    }
  }

  it("defaults off", () => {
    delete process.env[STUDIO_EIC_CONVERSATIONAL_INTAKE_FLAG_NAME];
    process.env.NODE_ENV = "development";
    assert.equal(isStudioEicConversationalIntakeFlagSet(), false);
    assert.equal(isStudioEicConversationalIntakeEnabled(), false);
    restore();
  });

  it("requires author intent and EIC flags", () => {
    process.env[STUDIO_EIC_CONVERSATIONAL_INTAKE_FLAG_NAME] = "1";
    process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME] = "1";
    delete process.env[STUDIO_EIC_FLAG_NAME];
    process.env.NODE_ENV = "development";
    assert.equal(isStudioEicConversationalIntakeEnabled(), false);

    process.env[STUDIO_EIC_FLAG_NAME] = "1";
    assert.equal(isStudioEicConversationalIntakeEnabled(), true);
    restore();
  });

  it("is unavailable in production", () => {
    process.env[STUDIO_EIC_CONVERSATIONAL_INTAKE_FLAG_NAME] = "1";
    process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME] = "1";
    process.env[STUDIO_EIC_FLAG_NAME] = "1";
    process.env.NODE_ENV = "production";
    assert.equal(isStudioEicConversationalIntakeEnabled(), false);
    restore();
  });
});
