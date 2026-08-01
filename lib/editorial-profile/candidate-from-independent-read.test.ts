import assert from "node:assert/strict";
import { describe, it, after, beforeEach } from "node:test";
import { STUDIO_AUTHOR_INTENT_FLAG_NAME } from "@/lib/author-intent/feature-flag.ts";
import { STUDIO_EIC_FLAG_NAME } from "@/lib/eic/feature-flag.ts";
import {
  buildBoundedSynthesisInput,
  createEditorialProfileCandidateFromIndependentRead,
  NON_ACTIVE_TERMINAL_STATUSES,
  synthesizeProfileFromBoundedInput,
  validateIndependentReadForSynthesis,
} from "./candidate-from-independent-read.ts";
import { STUDIO_EDITORIAL_PROFILE_FLAG_NAME } from "./feature-flag.ts";
import { validateForActivation, validateForDraft } from "./validation.ts";
import {
  buildCompleteIndependentRead,
  buildFixtureAuthorIntent,
  buildFixtureUnderstanding,
  buildMinimalIncompleteRead,
  FIXTURE_PROFILE_ID,
} from "./fixtures/independent-read-fixtures.ts";

function enableProfileFlags() {
  process.env[STUDIO_EDITORIAL_PROFILE_FLAG_NAME] = "1";
  process.env[STUDIO_EIC_FLAG_NAME] = "1";
  process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME] = "1";
  process.env.NODE_ENV = "development";
}

describe("EP-2 editorial profile candidate from independent read", () => {
  const savedProfile = process.env[STUDIO_EDITORIAL_PROFILE_FLAG_NAME];
  const savedEic = process.env[STUDIO_EIC_FLAG_NAME];
  const savedIntent = process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME];
  const savedNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    enableProfileFlags();
  });

  after(() => {
    if (savedProfile === undefined) delete process.env[STUDIO_EDITORIAL_PROFILE_FLAG_NAME];
    else process.env[STUDIO_EDITORIAL_PROFILE_FLAG_NAME] = savedProfile;
    if (savedEic === undefined) delete process.env[STUDIO_EIC_FLAG_NAME];
    else process.env[STUDIO_EIC_FLAG_NAME] = savedEic;
    if (savedIntent === undefined) delete process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME];
    else process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME] = savedIntent;
    process.env.NODE_ENV = savedNodeEnv;
  });

  it("1. feature flag off — synthesis rejected", () => {
    delete process.env[STUDIO_EDITORIAL_PROFILE_FLAG_NAME];
    const result = createEditorialProfileCandidateFromIndependentRead({
      profileId: FIXTURE_PROFILE_ID,
      independentRead: buildCompleteIndependentRead(),
      authorIntent: buildFixtureAuthorIntent(),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "feature_flag_disabled");
      assert.equal(result.status, "not_started");
    }
  });

  it("2. rejects incomplete independent read", () => {
    const result = createEditorialProfileCandidateFromIndependentRead({
      profileId: FIXTURE_PROFILE_ID,
      independentRead: buildCompleteIndependentRead({ status: "in_progress" }),
      authorIntent: buildFixtureAuthorIntent(),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "read_incomplete");
  });

  it("3. rejects failed independent read", () => {
    const check = validateIndependentReadForSynthesis(
      buildCompleteIndependentRead({ status: "failed" }),
      { manuscriptId: "ms-fixture-1", manuscriptVersionId: "ver-fixture-1" },
    );
    assert.equal(check.ok, false);
    if (!check.ok) assert.equal(check.code, "read_failed");
  });

  it("4. rejects stale independent read", () => {
    const check = validateIndependentReadForSynthesis(
      buildCompleteIndependentRead({ status: "stale" }),
      { manuscriptId: "ms-fixture-1", manuscriptVersionId: "ver-fixture-1" },
    );
    assert.equal(check.ok, false);
    if (!check.ok) assert.equal(check.code, "read_stale");
  });

  it("5. rejects manuscript identity mismatch", () => {
    const result = createEditorialProfileCandidateFromIndependentRead({
      profileId: FIXTURE_PROFILE_ID,
      independentRead: buildCompleteIndependentRead({ manuscript_id: "other-ms" }),
      authorIntent: buildFixtureAuthorIntent(),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "manuscript_mismatch");
  });

  it("6. rejects manuscript version mismatch", () => {
    const result = createEditorialProfileCandidateFromIndependentRead({
      profileId: FIXTURE_PROFILE_ID,
      independentRead: buildCompleteIndependentRead({ manuscript_version_id: "other-ver" }),
      authorIntent: buildFixtureAuthorIntent(),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "version_mismatch");
  });

  it("7. rejects unverifiable read without grounded evidence", () => {
    const read = buildCompleteIndependentRead({
      story_identity: {
        ...buildCompleteIndependentRead().story_identity,
        evidence: [],
      },
      story_engines: [],
      editorial_characteristics: [],
      protected_assets: [],
      editorial_risks: [],
      commercial_signals: {
        ...buildCompleteIndependentRead().commercial_signals,
        hook_evidence: [],
      },
    });
    const check = validateIndependentReadForSynthesis(read, {
      manuscriptId: "ms-fixture-1",
      manuscriptVersionId: "ver-fixture-1",
    });
    assert.equal(check.ok, false);
    if (!check.ok) assert.equal(check.code, "read_unverifiable");
  });

  it("8. rejects specialist access violation on read artifact", () => {
    const result = createEditorialProfileCandidateFromIndependentRead({
      profileId: FIXTURE_PROFILE_ID,
      independentRead: buildCompleteIndependentRead({ specialist_manuscript_access_count: 1 }),
      authorIntent: buildFixtureAuthorIntent(),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "specialist_access_violation");
  });

  it("9. rejects unconfirmed editorial understanding scope mismatch", () => {
    const result = createEditorialProfileCandidateFromIndependentRead({
      profileId: FIXTURE_PROFILE_ID,
      independentRead: buildCompleteIndependentRead(),
      authorIntent: buildFixtureAuthorIntent(),
      editorialUnderstanding: buildFixtureUnderstanding({
        status: "awaiting_author_confirmation",
      }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "understanding_mismatch");
  });

  it("10. full synthesis from fixture produces valid candidate", () => {
    const result = createEditorialProfileCandidateFromIndependentRead({
      profileId: FIXTURE_PROFILE_ID,
      independentRead: buildCompleteIndependentRead(),
      authorIntent: buildFixtureAuthorIntent(),
      editorialUnderstanding: buildFixtureUnderstanding(),
      generatedAt: "2026-08-01T02:00:00.000Z",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(validateForDraft(result.profile).ok, true);
      assert.equal(result.profile.independent_read_id, "read-fixture-1");
      assert.equal(result.profile.provenance.specialist_manuscript_access_count, 0);
    }
  });

  it("11. all ten profile sections structurally addressed", () => {
    const result = createEditorialProfileCandidateFromIndependentRead({
      profileId: FIXTURE_PROFILE_ID,
      independentRead: buildCompleteIndependentRead(),
      authorIntent: buildFixtureAuthorIntent(),
      editorialUnderstanding: buildFixtureUnderstanding(),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      const p = result.profile;
      assert.ok(p.story_identity.primary_identity.identity_key);
      assert.ok(p.story_engines.length >= 1);
      assert.ok(p.editorial_characteristics.length >= 5);
      assert.ok(p.technical_characteristics.length >= 1);
      assert.ok(p.emotional_characteristics.length >= 3);
      assert.ok(p.protected_assets.length >= 2);
      assert.ok(Array.isArray(p.editorial_risks));
      assert.ok(p.specialist_requirements.length >= 1);
      assert.ok(p.commercial_characteristics.commercial_assessment_scope);
      assert.ok(p.roadmap_inputs.primary_story_identity_key);
      assert.ok(p.synthesis_confidence.overall_confidence);
      assert.ok(p.provenance.independent_read_id);
    }
  });

  it("12. preserves manuscript evidence from read observations", () => {
    const read = buildCompleteIndependentRead();
    const result = createEditorialProfileCandidateFromIndependentRead({
      profileId: FIXTURE_PROFILE_ID,
      independentRead: read,
      authorIntent: buildFixtureAuthorIntent(),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      const firstEvidence = result.profile.story_identity.evidence[0];
      assert.equal(firstEvidence?.source, "manuscript");
      assert.equal(firstEvidence?.evidence_id, "ir-ev-1");
      assert.equal(firstEvidence?.locator.chapter_label, "Chapter 1");
    }
  });

  it("13. provenance records all source artifact ids", () => {
    const result = createEditorialProfileCandidateFromIndependentRead({
      profileId: FIXTURE_PROFILE_ID,
      independentRead: buildCompleteIndependentRead(),
      authorIntent: buildFixtureAuthorIntent(),
      editorialUnderstanding: buildFixtureUnderstanding(),
      manuscriptBriefId: "brief-1",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.profile.provenance.author_intent_id, "intent-fixture-1");
      assert.equal(result.profile.provenance.editorial_understanding_id, "understanding-fixture-1");
      assert.equal(result.profile.provenance.manuscript_brief_id, "brief-1");
      assert.equal(result.profile.provenance.independent_read_coverage, 78);
    }
  });

  it("14. author framing divergence preserved with alignment note", () => {
    const read = buildCompleteIndependentRead({
      commercial_signals: {
        ...buildCompleteIndependentRead().commercial_signals,
        author_market_framing: null,
      },
    });
    const result = createEditorialProfileCandidateFromIndependentRead({
      profileId: FIXTURE_PROFILE_ID,
      independentRead: read,
      authorIntent: buildFixtureAuthorIntent(),
      editorialUnderstanding: buildFixtureUnderstanding({
        market_position: "Memoir about family healing",
      }),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.profile.story_identity.author_framing_alignment, "divergent");
      assert.ok(result.profile.story_identity.alignment_note?.includes("Demonstrated identity"));
    }
  });

  it("15. editorial understanding used for framing only — not evidence", () => {
    const result = createEditorialProfileCandidateFromIndependentRead({
      profileId: FIXTURE_PROFILE_ID,
      independentRead: buildCompleteIndependentRead(),
      authorIntent: buildFixtureAuthorIntent(),
      editorialUnderstanding: buildFixtureUnderstanding(),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      for (const e of result.profile.story_identity.evidence) {
        assert.equal(e.source, "manuscript");
      }
      assert.equal(result.synthesisInput.framing.understanding_primary_vision, "High-stakes military thriller");
    }
  });

  it("16. never ends in active or updated status", () => {
    const result = createEditorialProfileCandidateFromIndependentRead({
      profileId: FIXTURE_PROFILE_ID,
      independentRead: buildCompleteIndependentRead(),
      authorIntent: buildFixtureAuthorIntent(),
      editorialUnderstanding: buildFixtureUnderstanding(),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.notEqual(result.status, "active");
      assert.notEqual(result.status, "updated");
      assert.notEqual(result.status, "superseded");
      assert.ok((NON_ACTIVE_TERMINAL_STATUSES as readonly string[]).includes(result.status));
    }
  });

  it("17. activation-ready fixture resolves to awaiting_eic_confirmation", () => {
    const result = createEditorialProfileCandidateFromIndependentRead({
      profileId: FIXTURE_PROFILE_ID,
      independentRead: buildCompleteIndependentRead(),
      authorIntent: buildFixtureAuthorIntent(),
      editorialUnderstanding: buildFixtureUnderstanding(),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.status, "awaiting_eic_confirmation");
      assert.equal(validateForActivation(result.profile).ok, true);
    }
  });

  it("18. thin read coverage yields incomplete_evidence status", () => {
    const result = createEditorialProfileCandidateFromIndependentRead({
      profileId: FIXTURE_PROFILE_ID,
      independentRead: buildMinimalIncompleteRead(),
      authorIntent: buildFixtureAuthorIntent(),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.status, "incomplete_evidence");
      assert.equal(validateForActivation(result.profile).ok, false);
    }
  });

  it("19. conflicting evidence polarity preserved without silent reconciliation", () => {
    const read = buildCompleteIndependentRead({
      story_identity: {
        ...buildCompleteIndependentRead().story_identity,
        evidence: [
          {
            evidence_id: "ir-ev-s",
            locator: { chapter_label: "Chapter 1" },
            observation: "Supports thriller identity",
            polarity: "supporting",
            source: "manuscript",
            grounded_in_manuscript: true,
          },
          {
            evidence_id: "ir-ev-c",
            locator: { chapter_label: "Chapter 8" },
            observation: "Slower literary pacing in midsection",
            polarity: "contrary",
            source: "manuscript",
            grounded_in_manuscript: true,
          },
        ],
        confidence: "medium",
      },
    });
    const result = createEditorialProfileCandidateFromIndependentRead({
      profileId: FIXTURE_PROFILE_ID,
      independentRead: read,
      authorIntent: buildFixtureAuthorIntent(),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      const polarities = result.profile.story_identity.evidence.map((e) => e.polarity);
      assert.ok(polarities.includes("supporting"));
      assert.ok(polarities.includes("contrary"));
    }
  });

  it("20. specialist requirements include none entries for unevaluated major domains", () => {
    const result = createEditorialProfileCandidateFromIndependentRead({
      profileId: FIXTURE_PROFILE_ID,
      independentRead: buildCompleteIndependentRead(),
      authorIntent: buildFixtureAuthorIntent(),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      const noneEntries = result.profile.specialist_requirements.filter(
        (r) => r.requirement_level === "none",
      );
      assert.ok(noneEntries.length >= 1);
      assert.ok(noneEntries.some((r) => r.domain_key === "combat_medicine"));
    }
  });

  it("21. commercial confidence capped at medium for pre-expert scope", () => {
    const read = buildCompleteIndependentRead({
      commercial_signals: {
        ...buildCompleteIndependentRead().commercial_signals,
        confidence: "high",
      },
    });
    const result = createEditorialProfileCandidateFromIndependentRead({
      profileId: FIXTURE_PROFILE_ID,
      independentRead: read,
      authorIntent: buildFixtureAuthorIntent(),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.profile.commercial_characteristics.confidence, "medium");
      assert.equal(
        result.profile.commercial_characteristics.commercial_assessment_scope,
        "pre_expert_preliminary",
      );
    }
  });

  it("22. roadmap inputs populated from read and profile sections", () => {
    const result = createEditorialProfileCandidateFromIndependentRead({
      profileId: FIXTURE_PROFILE_ID,
      independentRead: buildCompleteIndependentRead(),
      authorIntent: buildFixtureAuthorIntent(),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.profile.roadmap_inputs.primary_engine_key, "suspense_engine");
      assert.ok(result.profile.roadmap_inputs.top_protected_asset_ids.length >= 2);
      assert.equal(result.profile.roadmap_inputs.coverage_completeness, 78);
    }
  });

  it("23. bounded synthesis input excludes raw understanding conversation", () => {
    const input = buildBoundedSynthesisInput({
      independentRead: buildCompleteIndependentRead(),
      authorIntent: buildFixtureAuthorIntent(),
      editorialUnderstanding: buildFixtureUnderstanding(),
    });
    assert.equal(input.independent_read_id, "read-fixture-1");
    assert.equal(input.framing.author_intent_id, "intent-fixture-1");
    assert.ok(!("conversation_history" in (input as object)));
    assert.ok(!("stage_turns" in (input as object)));
  });

  it("24. aggregate synthesis confidence computed from coverage", () => {
    const synthesisInput = buildBoundedSynthesisInput({
      independentRead: buildCompleteIndependentRead({ coverage_percent: 55 }),
      authorIntent: buildFixtureAuthorIntent(),
    });
    const profile = synthesizeProfileFromBoundedInput({
      profileId: FIXTURE_PROFILE_ID,
      synthesisInput,
      generatedAt: "2026-08-01T02:00:00.000Z",
    });
    assert.equal(profile.synthesis_confidence.independent_read_coverage, 55);
    assert.equal(profile.synthesis_confidence.overall_confidence, "low");
  });

  it("25. constitutional flags remain false on synthesized profile", () => {
    const result = createEditorialProfileCandidateFromIndependentRead({
      profileId: FIXTURE_PROFILE_ID,
      independentRead: buildCompleteIndependentRead(),
      authorIntent: buildFixtureAuthorIntent(),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.profile.is_expert_finding, false);
      assert.equal(result.profile.is_manuscript_evidence, false);
      assert.equal(result.profile.is_author_intent, false);
      assert.equal(result.profile.activated_at, null);
    }
  });
});
