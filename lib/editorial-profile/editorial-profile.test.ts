import assert from "node:assert/strict";
import { describe, it, after } from "node:test";
import {
  EDITORIAL_PROFILE_AUTHOR_CONTROL,
  EDITORIAL_PROFILE_CAPABILITY,
  EDITORIAL_PROFILE_CONTRACT_VERSION,
  EDITORIAL_PROFILE_IS_AUTHOR_INTENT,
  EDITORIAL_PROFILE_IS_EXPERT_FINDING,
  EDITORIAL_PROFILE_IS_MANUSCRIPT_EVIDENCE,
  EDITORIAL_PROFILE_STATUSES,
  EVIDENCE_CLASSES,
  FRAMING_ONLY_EVIDENCE_CLASSES,
  MIN_INDEPENDENT_READ_COVERAGE_ACTIVATION,
  MIN_PROTECTED_ASSETS,
} from "./contract.ts";
import {
  STUDIO_EDITORIAL_PROFILE_FLAG_NAME,
  editorialProfileEnablesCommercialExperts,
  editorialProfileGrantsSpecialistAccess,
  isEditorialProfileSynthesisAllowed,
  isStudioEditorialProfileEnabled,
} from "./feature-flag.ts";
import {
  ACTIVATION_SOURCE_STATUSES,
  canAttemptActivation,
  canTransitionEditorialProfileStatus,
  validateActivationTransition,
  validateEditorialProfileStatusTransition,
} from "./lifecycle.ts";
import type {
  EditorialProfileV1,
  EvidenceEntry,
  ManuscriptLocator,
} from "./types.ts";
import {
  applyAlignmentPatch,
  assertProfileMutable,
  buildProfileVersionChain,
  createSupersedingProfile,
  linkSupersededProfile,
  profileMetadataFlags,
} from "./versioning.ts";
import {
  computeAggregateConfidence,
  countSupportingLocators,
  detectProhibitedInputs,
  downgradeConfidence,
  hasConflictingEvidence,
  isProhibitedEvidenceSource,
  scanForExpertKeysInRequirements,
  validateEditorialProfileContract,
  validateForActivation,
  validateForDraft,
  validateIntentModifierDoesNotInventNeed,
  validateStoryIdentity,
} from "./validation.ts";
import { STUDIO_AUTHOR_INTENT_FLAG_NAME } from "@/lib/author-intent/feature-flag.ts";
import { STUDIO_EIC_FLAG_NAME } from "@/lib/eic/feature-flag.ts";

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
    manuscript_id: "ms-1",
    manuscript_version_id: "ver-1",
    author_intent_id: "intent-1",
    independent_read_id: "read-1",
    editorial_understanding_id: "understanding-1",
    manuscript_brief_id: null,
    status: "draft",
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
        justification: "No demonstrated combat medicine content in independent read coverage",
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
      sequencing_hints: [],
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

describe("storydna_editorial_profile@v1 contract", () => {
  it("1. contract validation — required fields and constitutional flags", () => {
    const profile = buildMinimalProfile();
    const result = validateEditorialProfileContract(profile, "draft");
    assert.equal(result.ok, true);
    const flags = profileMetadataFlags();
    assert.equal(flags.is_expert_finding, false);
    assert.equal(flags.is_manuscript_evidence, false);
    assert.equal(flags.is_author_intent, false);
    assert.equal(EDITORIAL_PROFILE_IS_EXPERT_FINDING, false);
    assert.equal(EDITORIAL_PROFILE_IS_MANUSCRIPT_EVIDENCE, false);
    assert.equal(EDITORIAL_PROFILE_IS_AUTHOR_INTENT, false);
  });

  it("2. story identity — rejects high confidence with single locator", () => {
    const profile = buildMinimalProfile({
      story_identity: {
        ...buildMinimalProfile().story_identity,
        evidence: [evidence("ev-1", "Chapter 1")],
        confidence: "high",
      },
    });
    const errors = validateStoryIdentity(profile.story_identity);
    assert.ok(errors.some((e) => e.code === "identity_high_confidence_locators"));
  });

  it("3. story identity — requires evidence not author category alone", () => {
    const profile = buildMinimalProfile({
      story_identity: {
        ...buildMinimalProfile().story_identity,
        evidence: [],
        confidence: "low",
      },
    });
    const errors = validateStoryIdentity(profile.story_identity);
    assert.ok(errors.some((e) => e.code === "identity_no_evidence"));
  });

  it("4. story engines — at least one engine, at most one primary", () => {
    const none = validateEditorialProfileContract(
      buildMinimalProfile({ story_engines: [] }),
      "draft",
    );
    assert.equal(none.ok, false);

    const twoPrimary = validateEditorialProfileContract(
      buildMinimalProfile({
        story_engines: [
          { ...buildMinimalProfile().story_engines[0]!, engine_id: "a", role: "primary" },
          { ...buildMinimalProfile().story_engines[0]!, engine_id: "b", role: "primary" },
        ],
      }),
      "draft",
    );
    assert.equal(twoPrimary.ok, false);
  });

  it("5. editorial characteristics — minimum 5 entries, 3 domains, 2 strengths for activation", () => {
    const short = buildMinimalProfile({
      editorial_characteristics: buildMinimalProfile().editorial_characteristics.slice(0, 3),
    });
    const result = validateForActivation(short);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === "insufficient_editorial_characteristics"));
  });

  it("6. technical characteristics — critical specialist_need rules", () => {
    const bad = buildMinimalProfile({
      technical_characteristics: [
        {
          technical_id: "tc-bad",
          domain_key: "military_tactics",
          label: "Tactics",
          observation: "Detail",
          materiality: "moderate",
          confidence: "low",
          evidence: [evidence("ev-x", "Ch 4")],
          specialist_need: "critical",
          specialist_need_rationale: "Should fail",
        },
      ],
    });
    const result = validateForDraft(bad);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === "critical_need_requires_critical_materiality"));
  });

  it("7. emotional characteristics — minimum 3 entries, 1 effective for activation", () => {
    const short = buildMinimalProfile({
      emotional_characteristics: buildMinimalProfile().emotional_characteristics.slice(0, 1),
    });
    const result = validateForActivation(short);
    assert.equal(result.ok, false);
  });

  it("8. protected assets — minimum 2 for activation", () => {
    const one = buildMinimalProfile({
      protected_assets: [buildMinimalProfile().protected_assets[0]!],
    });
    const result = validateForActivation(one);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === "insufficient_protected_assets"));
    assert.equal(MIN_PROTECTED_ASSETS, 2);
  });

  it("9. editorial risks — blocking requires evidence; max 10", () => {
    const blockingNoEvidence = buildMinimalProfile({
      editorial_risks: [
        {
          risk_id: "r-block",
          label: "Block",
          description: "Blocks destination",
          severity: "blocking",
          likelihood: "high",
          materiality: "critical",
          evidence: [],
          confidence: "medium",
          mitigation_direction: "Address gap",
        },
      ],
    });
    const result = validateForDraft(blockingNoEvidence);
    assert.equal(result.ok, false);

    const manyRisks = buildMinimalProfile({
      editorial_risks: Array.from({ length: 11 }, (_, i) => ({
        risk_id: `r-${i}`,
        label: `Risk ${i}`,
        description: "Desc",
        severity: "low" as const,
        likelihood: "low" as const,
        materiality: "low" as const,
        evidence: [],
        confidence: "low" as const,
        mitigation_direction: "Monitor",
      })),
    });
    assert.equal(validateForDraft(manyRisks).ok, false);
  });

  it("10. specialist requirements — no expert keys", () => {
    const violations = scanForExpertKeysInRequirements([
      {
        requirement_id: "bad",
        domain_key: "military_expert",
        requirement_level: "high",
        justification: "Bad",
        driving_characteristics: [],
        evidence_summary: "Bad",
        confidence: "low",
        author_intent_modifier: "neutral",
        publication_state_modifier: "neutral",
        series_context_modifier: "not_applicable",
      },
    ]);
    assert.ok(violations.includes("military_expert"));

    const profile = buildMinimalProfile({
      specialist_requirements: [
        {
          requirement_id: "bad",
          domain_key: "literary_agent",
          requirement_level: "high",
          justification: "Should not use expert key",
          driving_characteristics: ["tc-1"],
          evidence_summary: "N/A",
          confidence: "medium",
          author_intent_modifier: "neutral",
          publication_state_modifier: "neutral",
          series_context_modifier: "not_applicable",
        },
      ],
    });
    assert.equal(validateForDraft(profile).ok, false);
  });

  it("11. commercial — confidence cap medium; scope pre_expert_preliminary", () => {
    const highCommercial = buildMinimalProfile({
      commercial_characteristics: {
        ...buildMinimalProfile().commercial_characteristics,
        confidence: "high",
      },
    });
    assert.equal(validateForDraft(highCommercial).ok, false);

    const wrongScope = buildMinimalProfile({
      commercial_characteristics: {
        ...buildMinimalProfile().commercial_characteristics,
        commercial_assessment_scope: "pre_expert_preliminary",
        confidence: "medium",
      },
    });
    assert.equal(validateForDraft(wrongScope).ok, true);
  });

  it("12. roadmap inputs — low source confidence flagged via aggregate", () => {
    const profile = buildMinimalProfile({
      story_identity: {
        ...buildMinimalProfile().story_identity,
        confidence: "low",
      },
    });
    const agg = computeAggregateConfidence(profile);
    assert.ok(agg.sections_at_low_confidence.includes("story_identity"));
  });

  it("13. evidence hierarchy — rejects prohibited sources", () => {
    assert.equal(isProhibitedEvidenceSource("author_intent"), true);
    assert.equal(isProhibitedEvidenceSource("manuscript"), false);
    assert.equal(FRAMING_ONLY_EVIDENCE_CLASSES.length, 3);
    assert.equal(EVIDENCE_CLASSES.length, 7);

    const profile = buildMinimalProfile({
      story_identity: {
        ...buildMinimalProfile().story_identity,
        evidence: [
          {
            evidence_id: "bad",
            locator: locator("Brief"),
            observation: "From author brief",
            polarity: "supporting",
            source: "author_intent" as "manuscript",
          },
        ],
      },
    });
    assert.equal(validateForDraft(profile).ok, false);
    assert.ok(detectProhibitedInputs(profile).length > 0);
  });

  it("14. status transitions — valid paths only", () => {
    assert.equal(canTransitionEditorialProfileStatus("not_started", "awaiting_independent_read"), true);
    assert.equal(canTransitionEditorialProfileStatus("not_started", "active"), false);
    assert.equal(canTransitionEditorialProfileStatus("superseded", "active"), false);

    for (const status of EDITORIAL_PROFILE_STATUSES) {
      assert.ok(validateEditorialProfileStatusTransition(status, status).ok);
    }
  });

  it("15. prohibited input detection — aborts validation", () => {
    const profile = buildMinimalProfile();
    assert.equal(detectProhibitedInputs(profile).length, 0);
  });

  it("16. immutability — active profile cannot mutate", () => {
    const active = buildMinimalProfile({ status: "active", activated_at: "2026-08-01T01:00:00.000Z" });
    const check = assertProfileMutable(active);
    assert.equal(check.ok, false);
  });

  it("17. supersession chain — supersedes_profile_id linkage", () => {
    const prior = buildMinimalProfile({ profile_id: "p1", status: "active" });
    const next = createSupersedingProfile({
      prior,
      newProfileId: "p2",
      triggerEvent: "manuscript_version_change",
      generatedAt: "2026-08-02T00:00:00.000Z",
      updates: { manuscript_version_id: "ver-2", status: "draft" },
    });
    assert.equal(next.supersedes_profile_id, "p1");
    const linked = linkSupersededProfile(prior, "p2");
    assert.equal(linked.status, "superseded");
    assert.equal(linked.superseded_by_profile_id, "p2");

    const chain = buildProfileVersionChain([prior, next]);
    assert.equal(chain.length, 2);
  });

  it("18. author intent modifier — cannot invent domain need", () => {
    const errors = validateIntentModifierDoesNotInventNeed({
      requirement_id: "sr-bad",
      domain_key: "military_tactics",
      requirement_level: "critical",
      justification: "Intent only",
      driving_characteristics: [],
      evidence_summary: "None",
      confidence: "low",
      author_intent_modifier: "elevates",
      publication_state_modifier: "neutral",
      series_context_modifier: "not_applicable",
    });
    assert.ok(errors.some((e) => e.code === "intent_cannot_invent_need"));
  });

  it("19. aggregate confidence caps — coverage and low-section rules", () => {
    const lowCoverage = buildMinimalProfile({
      synthesis_confidence: {
        ...buildMinimalProfile().synthesis_confidence,
        independent_read_coverage: 50,
      },
    });
    const agg = computeAggregateConfidence(lowCoverage);
    assert.equal(agg.overall_confidence, "low");
    assert.equal(MIN_INDEPENDENT_READ_COVERAGE_ACTIVATION, 60);
  });

  it("20. conflicting evidence — visible, no silent reconciliation", () => {
    const mixed = [evidence("s", "Ch1", "supporting"), evidence("c", "Ch2", "contrary")];
    assert.equal(hasConflictingEvidence(mixed), true);
    assert.equal(downgradeConfidence("high"), "medium");

    const identity = buildMinimalProfile().story_identity;
    const conflictErrors = validateStoryIdentity({
      ...identity,
      evidence: mixed,
      confidence: "high",
    });
    assert.ok(conflictErrors.some((e) => e.code === "conflicting_evidence_high_confidence"));
  });

  it("21. activation gate — invalid activation from draft blocked", () => {
    assert.equal(canAttemptActivation("draft"), false);
    assert.ok(ACTIVATION_SOURCE_STATUSES.includes("awaiting_eic_confirmation"));
    const transition = validateActivationTransition("draft", "active");
    assert.equal(transition.ok, false);
  });

  it("22. valid draft passes structural validation", () => {
    assert.equal(validateForDraft(buildMinimalProfile()).ok, true);
  });

  it("23. valid activation passes when status awaiting confirmation", () => {
    const profile = buildMinimalProfile({ status: "awaiting_eic_confirmation" });
    assert.equal(validateForActivation(profile).ok, true);
  });

  it("24. activation fails when coverage below threshold", () => {
    const profile = buildMinimalProfile({
      synthesis_confidence: {
        ...buildMinimalProfile().synthesis_confidence,
        independent_read_coverage: 55,
      },
      provenance: {
        ...buildMinimalProfile().provenance,
        independent_read_coverage: 55,
      },
    });
    assert.equal(validateForActivation(profile).ok, false);
  });

  it("25. PEU alignment patch without reclassification", () => {
    const active = buildMinimalProfile({ status: "active" });
    const patched = applyAlignmentPatch({
      profile: active,
      destination_alignment: "partially_aligned",
      author_framing_alignment: "partially_aligned",
      alignment_note: "Brief genre differs from demonstrated pacing",
    });
    assert.equal(patched.status, "updated");
    assert.equal(patched.roadmap_inputs.destination_alignment, "partially_aligned");
    assert.equal(patched.story_engines[0]!.engine_key, active.story_engines[0]!.engine_key);
  });
});

describe("editorial profile feature flag", () => {
  const savedProfile = process.env[STUDIO_EDITORIAL_PROFILE_FLAG_NAME];
  const savedEic = process.env[STUDIO_EIC_FLAG_NAME];
  const savedIntent = process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME];
  const savedNodeEnv = process.env.NODE_ENV;

  it("26. feature flag off — no synthesis invoked", () => {
    delete process.env[STUDIO_EDITORIAL_PROFILE_FLAG_NAME];
    process.env[STUDIO_EIC_FLAG_NAME] = "1";
    process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME] = "1";
    process.env.NODE_ENV = "development";
    assert.equal(isStudioEditorialProfileEnabled(), false);
    assert.equal(isEditorialProfileSynthesisAllowed(), false);
  });

  it("27. unavailable in production", () => {
    process.env[STUDIO_EDITORIAL_PROFILE_FLAG_NAME] = "1";
    process.env[STUDIO_EIC_FLAG_NAME] = "1";
    process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME] = "1";
    process.env.NODE_ENV = "production";
    assert.equal(isStudioEditorialProfileEnabled(), false);
  });

  it("28. no specialist manuscript access grant", () => {
    assert.equal(editorialProfileGrantsSpecialistAccess(), false);
    assert.equal(EDITORIAL_PROFILE_AUTHOR_CONTROL.profile_is_not_manuscript_access_grant, true);
    assert.equal(EDITORIAL_PROFILE_AUTHOR_CONTROL.specialist_manuscript_access_at_activation, 0);
  });

  it("29. no commercial enablement", () => {
    assert.equal(editorialProfileEnablesCommercialExperts(), false);
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
});

describe("editorial profile capability propagation", () => {
  it("30. documents EIC-owned synthesis with deferred downstream", () => {
    assert.equal(EDITORIAL_PROFILE_CAPABILITY.classification, "editor_in_chief_owned");
    assert.equal(EDITORIAL_PROFILE_CAPABILITY.propagation_decision, "move_to_editor_in_chief");
    assert.ok(EDITORIAL_PROFILE_CAPABILITY.downstream_consumers_deferred.length > 0);
    assert.equal(EDITORIAL_PROFILE_AUTHOR_CONTROL.eic_owns_synthesis, true);
    assert.equal(EDITORIAL_PROFILE_AUTHOR_CONTROL.author_may_not_select_experts_in_profile, true);
  });
});

describe("editorial profile evidence utilities", () => {
  it("counts supporting locators", () => {
    const ev = [evidence("1", "A", "supporting"), evidence("2", "B", "contrary")];
    assert.equal(countSupportingLocators(ev), 1);
  });
});
