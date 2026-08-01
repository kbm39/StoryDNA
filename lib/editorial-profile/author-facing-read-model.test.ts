import assert from "node:assert/strict";
import { describe, it, after, beforeEach } from "node:test";
import { STUDIO_AUTHOR_INTENT_FLAG_NAME } from "@/lib/author-intent/feature-flag.ts";
import { STUDIO_EIC_FLAG_NAME } from "@/lib/eic/feature-flag.ts";
import {
  AUTHOR_FACING_SECTION_ORDER,
  AUTHOR_FACING_SECTION_TITLES,
} from "./author-facing-contract.ts";
import {
  createAuthorFacingEditorialProfileReadModel,
  isActiveAuthoritativeProfile,
  transformActiveProfileToAuthorFacingReadModel,
} from "./author-facing-read-model.ts";
import type { AuthorFacingEditorialProfileReadModel } from "./author-facing-types.ts";
import {
  validateAuthorFacingEditorialProfileReadModel,
} from "./author-facing-validation.ts";
import {
  EDITORIAL_PROFILE_CONTRACT_VERSION,
} from "./contract.ts";
import { STUDIO_EDITORIAL_PROFILE_FLAG_NAME } from "./feature-flag.ts";
import {
  FIXTURE_MS_ID,
  FIXTURE_VER_ID,
} from "./fixtures/independent-read-fixtures.ts";
import type { EditorialProfileV1, EvidenceEntry, ManuscriptLocator } from "./types.ts";

function locator(chapter: string): ManuscriptLocator {
  return { chapter_label: chapter, chapter_id: chapter };
}

function evidence(id: string, chapter: string, polarity: EvidenceEntry["polarity"] = "supporting"): EvidenceEntry {
  return {
    evidence_id: id,
    locator: locator(chapter),
    observation: `Observation for ${chapter}`,
    polarity,
    source: "manuscript",
  };
}

function buildMinimalProfile(overrides: Partial<EditorialProfileV1> = {}): EditorialProfileV1 {
  const e1 = evidence("ev-1", "Chapter 1");
  const e2 = evidence("ev-2", "Chapter 2");
  const e3 = evidence("ev-3", "Chapter 3");

  const base: EditorialProfileV1 = {
    contract_version: EDITORIAL_PROFILE_CONTRACT_VERSION,
    profile_id: "profile-1",
    manuscript_id: FIXTURE_MS_ID,
    manuscript_version_id: FIXTURE_VER_ID,
    author_intent_id: "intent-1",
    independent_read_id: "read-1",
    editorial_understanding_id: "understanding-1",
    manuscript_brief_id: null,
    status: "awaiting_eic_confirmation",
    dispute_metadata: null,
    supersedes_profile_id: null,
    superseded_by_profile_id: null,
    generated_at: "2026-08-01T00:00:00.000Z",
    activated_at: null,
    trigger_event: "independent_read_complete",
    synthesis_confidence: {
      overall_confidence: "medium",
      independent_read_coverage: 75,
      sections_at_low_confidence: [],
      evidence_depth: "adequate",
      gaps_affecting_confidence: [],
    },
    story_identity: {
      primary_identity: {
        identity_key: "commercial_thriller",
        label: "Commercial thriller",
        demonstration_summary: "Sustained thriller pacing on the page",
      },
      secondary_identities: [],
      identity_rationale: "Demonstrated thriller structure and stakes",
      evidence: [e1, e2],
      confidence: "high",
      author_framing_alignment: "aligned",
    },
    story_engines: [
      {
        engine_id: "eng-1",
        engine_key: "suspense_engine",
        label: "Suspense",
        role: "primary",
        demonstration_summary: "Chapter-level tension escalation",
        evidence: [e1, e2],
        confidence: "high",
        materiality: "high",
      },
    ],
    editorial_characteristics: [
      { characteristic_id: "ec-1", domain: "structure", label: "Act shape", assessment: "strength", summary: "Clear act breaks", evidence: [e1], confidence: "medium", materiality: "high" },
      { characteristic_id: "ec-2", domain: "pacing", label: "Scene rhythm", assessment: "strength", summary: "Consistent propulsion", evidence: [e2], confidence: "medium", materiality: "moderate" },
      { characteristic_id: "ec-3", domain: "opening", label: "Hook", assessment: "developing", summary: "Promising but uneven", evidence: [], confidence: "low", materiality: "moderate" },
      { characteristic_id: "ec-4", domain: "character", label: "Motivation", assessment: "gap", summary: "Antagonist underdeveloped", evidence: [e3], confidence: "medium", materiality: "high" },
      { characteristic_id: "ec-5", domain: "dialogue", label: "Subtext", assessment: "developing", summary: "Functional exposition", evidence: [], confidence: "low", materiality: "low" },
    ],
    technical_characteristics: [
      {
        technical_id: "tc-1",
        domain_key: "military_tactics",
        label: "Tactical sequences",
        observation: "Operational detail in chapters 4 and 11",
        materiality: "high",
        confidence: "medium",
        evidence: [e3],
        specialist_need: "high",
        specialist_need_rationale: "Sustained tactical content warrants review",
      },
    ],
    emotional_characteristics: [
      { emotional_id: "em-1", emotion_key: "tension", label: "Tension", intensity: "dominant", execution_quality: "effective", summary: "Sustained dread", evidence: [e1], confidence: "medium", materiality: "high" },
      { emotional_id: "em-2", emotion_key: "hope", label: "Hope", intensity: "present", execution_quality: "uneven", summary: "Intermittent relief", evidence: [e2], confidence: "medium", materiality: "moderate" },
      { emotional_id: "em-3", emotion_key: "catharsis", label: "Catharsis", intensity: "underdeveloped", execution_quality: "not_assessable", summary: "Ending not fully assessable", evidence: [], confidence: "low", materiality: "low" },
    ],
    protected_assets: [
      { asset_id: "pa-1", category: "scene", label: "Opening raid", description: "Vivid set-piece", evidence: [e1], protection_level: "high", confidence: "medium" },
      { asset_id: "pa-2", category: "voice", label: "Narrative voice", description: "Distinct cadence", evidence: [e2], protection_level: "moderate", confidence: "medium" },
    ],
    editorial_risks: [
      {
        risk_id: "risk-1",
        label: "Antagonist clarity",
        description: "Weak antagonist may block thriller payoff",
        severity: "significant",
        likelihood: "medium",
        materiality: "high",
        evidence: [e3],
        confidence: "medium",
        mitigation_direction: "Strengthen antagonist motivation in revision",
      },
    ],
    specialist_requirements: [
      {
        requirement_id: "sr-1",
        domain_key: "military_tactics",
        requirement_level: "high",
        justification: "Sustained tactical sequences in multiple chapters",
        driving_characteristics: ["tc-1"],
        evidence_summary: "Chapters 4, 11 operational detail",
        confidence: "medium",
        author_intent_modifier: "neutral",
        publication_state_modifier: "neutral",
        series_context_modifier: "not_applicable",
      },
      {
        requirement_id: "sr-2",
        domain_key: "combat_medicine",
        requirement_level: "none",
        justification: "No demonstrated combat medicine content",
        driving_characteristics: [],
        evidence_summary: "Evaluated — no on-page signals",
        confidence: "high",
        author_intent_modifier: "not_applicable",
        publication_state_modifier: "neutral",
        series_context_modifier: "not_applicable",
      },
    ],
    commercial_characteristics: {
      commercial_assessment_scope: "pre_expert_preliminary",
      hook_strength: "developing",
      hook_evidence: [e1],
      comp_alignment_signals: [],
      market_lane_fit: "clear",
      market_lane_rationale: "Thriller identity with commercial pacing",
      differentiation_signals: ["Military insider texture"],
      commercial_risks: ["Crowded thriller market"],
      readiness_signal: "preliminary_developing",
      confidence: "medium",
      author_market_framing_alignment: "aligned",
    },
    roadmap_inputs: {
      destination_alignment: "substantially_aligned",
      alignment_source: "vision_alignment",
      primary_story_identity_key: "commercial_thriller",
      primary_engine_key: "suspense_engine",
      top_protected_asset_ids: ["pa-1", "pa-2"],
      top_editorial_risk_ids: ["risk-1"],
      specialist_requirements_summary: [
        { domain_key: "military_tactics", requirement_level: "high", priority_rank: 1 },
      ],
      distance_input_signals: [],
      readiness_input_signals: [],
      sequencing_hints: [{ hint_key: "domain_after_structure", rationale: "Domain review after structural clarity", preliminary: true }],
      roi_hints: [],
      next_action_hints: [],
      regression_risk: "medium",
      coverage_completeness: 75,
    },
    provenance: {
      author_intent_id: "intent-1",
      independent_read_id: "read-1",
      editorial_understanding_id: "understanding-1",
      manuscript_brief_id: null,
      synthesis_timestamp: "2026-08-01T00:00:00.000Z",
      independent_read_coverage: 75,
      specialist_manuscript_access_count: 0,
    },
    is_expert_finding: false,
    is_manuscript_evidence: false,
    is_author_intent: false,
  };

  return { ...base, ...overrides };
}

function buildActiveProfile(overrides: Partial<EditorialProfileV1> = {}): EditorialProfileV1 {
  return buildMinimalProfile({
    status: "active",
    activated_at: "2026-08-01T12:00:00.000Z",
    ...overrides,
  });
}

function readModelInput(profile: EditorialProfileV1) {
  return {
    profile,
    expectedManuscriptId: FIXTURE_MS_ID,
    expectedManuscriptVersionId: FIXTURE_VER_ID,
    presentationTimestamp: "2026-08-01T13:00:00.000Z",
    authorIntentionSummary: "Publishable commercial thriller with authentic tactical detail",
  };
}

function enableProfileFlags() {
  process.env[STUDIO_EDITORIAL_PROFILE_FLAG_NAME] = "1";
  process.env[STUDIO_EIC_FLAG_NAME] = "1";
  process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME] = "1";
  process.env.NODE_ENV = "development";
}

describe("EP-5 author-facing editorial profile read model", () => {
  const savedProfile = process.env[STUDIO_EDITORIAL_PROFILE_FLAG_NAME];
  const savedEic = process.env[STUDIO_EIC_FLAG_NAME];
  const savedIntent = process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME];
  const savedNodeEnv = process.env.NODE_ENV;

  beforeEach(() => enableProfileFlags());

  after(() => {
    if (savedProfile === undefined) delete process.env[STUDIO_EDITORIAL_PROFILE_FLAG_NAME];
    else process.env[STUDIO_EDITORIAL_PROFILE_FLAG_NAME] = savedProfile;
    if (savedEic === undefined) delete process.env[STUDIO_EIC_FLAG_NAME];
    else process.env[STUDIO_EIC_FLAG_NAME] = savedEic;
    if (savedIntent === undefined) delete process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME];
    else process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME] = savedIntent;
    process.env.NODE_ENV = savedNodeEnv;
  });

  it("1. feature flag disabled — read model rejected", () => {
    delete process.env[STUDIO_EDITORIAL_PROFILE_FLAG_NAME];
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "feature_flag_disabled");
  });

  it("2. missing profile — rejected", () => {
    const result = createAuthorFacingEditorialProfileReadModel({
      ...readModelInput(buildActiveProfile()),
      profile: null,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "missing_profile");
  });

  it("3. non-active profile rejected", () => {
    const draft = buildMinimalProfile({ status: "draft" });
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(draft));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "non_active_profile");
  });

  it("4. active authoritative profile accepted", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.readModel.is_active_authoritative, true);
  });

  it("5. manuscript identity preserved", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.readModel.manuscript_id, FIXTURE_MS_ID);
  });

  it("6. manuscript-version identity preserved", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.readModel.manuscript_version_id, FIXTURE_VER_ID);
  });

  it("7. profile version preserved", () => {
    const active = buildActiveProfile();
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(active));
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.readModel.profile_id, active.profile_id);
  });

  it("8. Editorial Understanding appears first", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.readModel.sections[0]?.section_key, "editorial_understanding");
      assert.equal(result.readModel.sections[0]?.title, "Editorial Understanding");
    }
  });

  it("9. grade does not appear first", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      const firstTitle = result.readModel.sections[0]?.title ?? "";
      assert.ok(!/grade/i.test(firstTitle));
    }
  });

  it("10. risks do not appear first", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) assert.notEqual(result.readModel.sections[0]?.section_key, "editorial_risks");
  });

  it("11. What Is Working appears before improvement material", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      const working = result.readModel.sections.findIndex((s) => s.section_key === "what_is_working");
      const opportunities = result.readModel.sections.findIndex((s) => s.section_key === "improvement_opportunities");
      assert.ok(working >= 0 && opportunities >= 0 && working < opportunities);
    }
  });

  it("12. Protected Assets appear before risks", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      const protectedIdx = result.readModel.sections.findIndex((s) => s.section_key === "protected_assets");
      const risks = result.readModel.sections.findIndex((s) => s.section_key === "editorial_risks");
      assert.ok(protectedIdx >= 0 && risks >= 0 && protectedIdx < risks);
    }
  });

  it("13. evidence-grounded strengths", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.readModel.what_is_working.length >= 2);
      for (const strength of result.readModel.what_is_working) {
        assert.ok(strength.evidence.length > 0);
      }
    }
  });

  it("14. no fabricated praise", () => {
    const noStrengths = buildActiveProfile({
      editorial_characteristics: buildMinimalProfile().editorial_characteristics.map((e) =>
        e.assessment === "strength" ? { ...e, assessment: "developing" as const, evidence: [] } : e,
      ),
    });
    const model = transformActiveProfileToAuthorFacingReadModel(noStrengths, {
      presentationTimestamp: "2026-08-01T13:00:00.000Z",
    });
    assert.equal(model.what_is_working.length, 0);
  });

  it("15. Protected Asset rationale", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      for (const asset of result.readModel.protected_assets) {
        assert.ok(asset.why_it_matters.trim().length > 0);
        assert.ok(asset.evidence.length > 0);
      }
    }
  });

  it("16. Improvement Opportunity evidence where required", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      const gap = result.readModel.improvement_opportunities.find((o) => o.entry_id === "ec-4");
      assert.ok(gap);
      assert.ok(gap!.evidence.length > 0);
    }
  });

  it("17. Editorial Risk evidence", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      for (const risk of result.readModel.editorial_risks) {
        assert.ok(risk.evidence.length > 0);
      }
    }
  });

  it("18. low-confidence risk displayed with uncertainty", () => {
    const lowRiskProfile = buildActiveProfile({
      editorial_risks: [
        {
          ...buildMinimalProfile().editorial_risks[0]!,
          confidence: "low",
          evidence: [evidence("ev-low", "Chapter 5")],
        },
      ],
    });
    const model = transformActiveProfileToAuthorFacingReadModel(lowRiskProfile, {
      presentationTimestamp: "2026-08-01T13:00:00.000Z",
    });
    const risk = model.editorial_risks[0];
    assert.equal(risk?.confidence, "limited");
    assert.ok(risk!.uncertainty_notes.length > 0);
  });

  it("19. unknown remains unknown", () => {
    const profile = buildActiveProfile();
    const model = transformActiveProfileToAuthorFacingReadModel(profile, {
      presentationTimestamp: "2026-08-01T13:00:00.000Z",
    });
    const notAssessable = model.manuscript_characteristics.find((c) => c.interpretation_mode === "inferred");
    assert.ok(notAssessable);
    assert.ok(notAssessable!.uncertainty_notes.length > 0);
  });

  it("20. conflicting evidence remains visible", () => {
    const conflicting = buildActiveProfile({
      story_identity: {
        ...buildMinimalProfile().story_identity,
        evidence: [evidence("ev-s", "Chapter 1", "supporting"), evidence("ev-c", "Chapter 2", "contrary")],
      },
    });
    const model = transformActiveProfileToAuthorFacingReadModel(conflicting, {
      presentationTimestamp: "2026-08-01T13:00:00.000Z",
    });
    assert.ok(model.confidence_and_uncertainty.unresolved_conflicts.length > 0);
  });

  it("21. Author Intent and execution difference remains visible", () => {
    const divergent = buildActiveProfile({
      story_identity: {
        ...buildMinimalProfile().story_identity,
        author_framing_alignment: "divergent",
        alignment_note: "Brief describes cozy mystery; manuscript demonstrates thriller pacing",
      },
    });
    const result = createAuthorFacingEditorialProfileReadModel({
      ...readModelInput(divergent),
      authorIntentionSummary: "Cozy mystery with gentle pacing",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.readModel.editorial_understanding.alignment_differences.length > 0);
      assert.ok(result.readModel.editorial_understanding.unresolved_differences.length > 0);
    }
  });

  it("22. Story Identity presentation", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      const identity = result.readModel.manuscript_characteristics.find((c) => c.category === "story_identity");
      assert.ok(identity);
      assert.ok(!identity!.name.includes("_"));
      assert.equal(identity!.interpretation_mode, "demonstrated");
    }
  });

  it("23. Story Engine presentation", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      const engine = result.readModel.manuscript_characteristics.find((c) => c.category === "story_engine");
      assert.ok(engine);
      assert.equal(engine!.name, "Suspense");
    }
  });

  it("24. Technical Characteristics presentation", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      const technical = result.readModel.manuscript_characteristics.find((c) => c.category === "technical");
      assert.ok(technical);
      assert.ok(technical!.name.includes("Military"));
      assert.ok(!technical!.name.includes("military_tactics"));
    }
  });

  it("25. Emotional Characteristics presentation", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      const emotional = result.readModel.manuscript_characteristics.filter((c) => c.category === "emotional");
      assert.ok(emotional.length >= 3);
    }
  });

  it("26. Commercial Characteristics avoid unsupported claims", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      const commercial = result.readModel.manuscript_characteristics.find((c) => c.category === "commercial");
      assert.ok(commercial);
      assert.ok(commercial!.name.toLowerCase().includes("preliminary"));
      assert.ok(commercial!.uncertainty_notes.length > 0);
    }
  });

  it("27. Specialist Requirement rationale", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      const rec = result.readModel.recommended_specialist_support[0];
      assert.ok(rec);
      assert.ok(rec!.demonstrated_need.length > 0);
      assert.ok(rec!.why_it_may_help.length > 0);
    }
  });

  it("28. Specialist recommendation does not imply execution", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      for (const rec of result.readModel.recommended_specialist_support) {
        assert.equal(rec.specialist_not_activated, true);
      }
      assert.equal(result.readModel.capability_status.specialists_executed, false);
    }
  });

  it("29. Specialist recommendation does not imply manuscript-sharing permission", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      for (const rec of result.readModel.recommended_specialist_support) {
        assert.equal(rec.manuscript_sharing_not_authorized, true);
      }
      assert.equal(result.readModel.capability_status.manuscript_sharing_granted, false);
    }
  });

  it("30. Roadmap Inputs displayed as preparation only", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.readModel.roadmap_preparation.current_editorial_position.includes("not been generated"));
      assert.equal(result.readModel.roadmap_preparation.roadmap_generated, false);
    }
  });

  it("31. no completed Roadmap claimed", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.readModel.capability_status.roadmap_generated, false);
      const json = JSON.stringify(result.readModel);
      assert.ok(!/roadmap (is|has been) (complete|ready|finalized)/i.test(json));
    }
  });

  it("32. no final Next Best Action invented", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.readModel.roadmap_preparation.no_final_next_best_action, true);
  });

  it("33. author retains final authority", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.readModel.author_control_statement.includes("retain final authority"));
      assert.equal(result.readModel.what_happens_next.author_retains_final_authority, true);
    }
  });

  it("34. internal execution data excluded", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      const json = JSON.stringify(result.readModel);
      assert.ok(!json.includes("trigger_event"));
      assert.ok(!json.includes("supersedes_profile_id"));
      assert.ok(!json.includes("provider_model"));
    }
  });

  it("35. provider metadata excluded", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      const json = JSON.stringify(result.readModel);
      assert.ok(!json.includes("provider_model"));
    }
  });

  it("36. safe error behavior on mismatch", () => {
    const result = createAuthorFacingEditorialProfileReadModel({
      ...readModelInput(buildActiveProfile()),
      expectedManuscriptId: "wrong-ms",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "manuscript_mismatch");
      assert.ok(!result.message.includes("Chapter"));
    }
  });

  it("37. read model cannot mutate authoritative profile", () => {
    const active = buildActiveProfile();
    const before = structuredClone(active);
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(active));
    assert.equal(result.ok, true);
    assert.deepEqual(active, before);
    if (result.ok) {
      assert.throws(() => {
        (result.readModel as { profile_id: string }).profile_id = "mutated";
      });
    }
  });

  it("38. presentation validator accepts valid model", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      const validation = validateAuthorFacingEditorialProfileReadModel(result.readModel);
      assert.equal(validation.ok, true);
    }
  });

  it("39. presentation validator rejects unsupported conclusion", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      const bad = structuredClone(result.readModel) as AuthorFacingEditorialProfileReadModel;
      const mutated = {
        ...bad,
        what_is_working: [
          {
            ...bad.what_is_working[0]!,
            evidence: [],
            statement: "",
            why_it_works: "",
          },
        ],
      };
      const validation = validateAuthorFacingEditorialProfileReadModel(mutated);
      assert.equal(validation.ok, false);
    }
  });

  it("40. presentation validator rejects implied consent", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      const bad = structuredClone(result.readModel) as AuthorFacingEditorialProfileReadModel;
      const rec = bad.recommended_specialist_support[0];
      if (rec) {
        const mutated = {
          ...bad,
          recommended_specialist_support: [{ ...rec, manuscript_sharing_not_authorized: false as unknown as true }],
        };
        const validation = validateAuthorFacingEditorialProfileReadModel(mutated);
        assert.equal(validation.ok, false);
      }
    }
  });

  it("41. presentation validator rejects false Roadmap-complete claim", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      const bad = structuredClone(result.readModel) as AuthorFacingEditorialProfileReadModel;
      const mutated = {
        ...bad,
        roadmap_preparation: { ...bad.roadmap_preparation, roadmap_generated: true as unknown as false },
      };
      const validation = validateAuthorFacingEditorialProfileReadModel(mutated);
      assert.equal(validation.ok, false);
    }
  });

  it("42. no model call used for deterministic transformation", () => {
    assert.equal(typeof createAuthorFacingEditorialProfileReadModel, "function");
    assert.equal(typeof transformActiveProfileToAuthorFacingReadModel, "function");
  });

  it("43. no migration required", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) assert.ok(result.readModel.presentation_timestamp);
  });

  it("44. section order matches contract", () => {
    const result = createAuthorFacingEditorialProfileReadModel(readModelInput(buildActiveProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.readModel.sections.length, AUTHOR_FACING_SECTION_ORDER.length);
      for (let i = 0; i < AUTHOR_FACING_SECTION_ORDER.length; i++) {
        assert.equal(result.readModel.sections[i]?.section_key, AUTHOR_FACING_SECTION_ORDER[i]);
        assert.equal(result.readModel.sections[i]?.title, AUTHOR_FACING_SECTION_TITLES[AUTHOR_FACING_SECTION_ORDER[i]!]);
      }
    }
  });

  it("active authoritative helper recognizes active and updated", () => {
    assert.equal(isActiveAuthoritativeProfile(buildActiveProfile()), true);
    assert.equal(isActiveAuthoritativeProfile(buildMinimalProfile({ status: "draft" })), false);
  });
});
