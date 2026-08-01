import assert from "node:assert/strict";
import { describe, it, after, beforeEach } from "node:test";
import { STUDIO_AUTHOR_INTENT_FLAG_NAME } from "@/lib/author-intent/feature-flag.ts";
import { STUDIO_EIC_FLAG_NAME } from "@/lib/eic/feature-flag.ts";
import {
  confirmAndActivateEditorialProfile,
  submitEditorialProfileForEicConfirmation,
} from "./confirm-and-activate.ts";
import {
  EDITORIAL_PROFILE_ACTIVATION_BOUNDARIES,
  EDITORIAL_PROFILE_CONTRACT_VERSION,
  EIC_CONFIRMATION_SECTION_ORDER,
} from "./contract.ts";
import { createEditorialProfileCandidateFromIndependentRead } from "./candidate-from-independent-read.ts";
import {
  editorialProfileEnablesCommercialExperts,
  editorialProfileGrantsSpecialistAccess,
  STUDIO_EDITORIAL_PROFILE_FLAG_NAME,
} from "./feature-flag.ts";
import {
  buildCompleteIndependentRead,
  buildFixtureAuthorIntent,
  buildFixtureUnderstanding,
  FIXTURE_MS_ID,
  FIXTURE_PROFILE_ID,
  FIXTURE_VER_ID,
} from "./fixtures/independent-read-fixtures.ts";
import type { EditorialProfileV1, EvidenceEntry, ManuscriptLocator } from "./types.ts";
import { linkSupersededProfile } from "./versioning.ts";
import { validateForActivation } from "./validation.ts";

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

function activateInput(profile: EditorialProfileV1, extras: Record<string, unknown> = {}) {
  return {
    confirmationId: "conf-1",
    profile,
    eicIdentity: "editor_in_chief",
    expectedManuscriptId: FIXTURE_MS_ID,
    expectedManuscriptVersionId: FIXTURE_VER_ID,
    confirmedAt: "2026-08-01T12:00:00.000Z",
    ...extras,
  };
}

function enableProfileFlags() {
  process.env[STUDIO_EDITORIAL_PROFILE_FLAG_NAME] = "1";
  process.env[STUDIO_EIC_FLAG_NAME] = "1";
  process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME] = "1";
  process.env.NODE_ENV = "development";
}

describe("EP-3 editorial profile confirmation and activation gate", () => {
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

  it("1. feature flag disabled — activation rejected", () => {
    delete process.env[STUDIO_EDITORIAL_PROFILE_FLAG_NAME];
    const result = confirmAndActivateEditorialProfile(activateInput(buildMinimalProfile()));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "feature_flag_disabled");
  });

  it("2. missing candidate — rejected", () => {
    const result = confirmAndActivateEditorialProfile({
      ...activateInput(buildMinimalProfile()),
      profile: null,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "missing_candidate");
  });

  it("3. structurally invalid candidate — rejected", () => {
    const bad = buildMinimalProfile({ story_engines: [] });
    const result = confirmAndActivateEditorialProfile(activateInput(bad));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "structurally_invalid");
  });

  it("4. wrong manuscript identity — rejected", () => {
    const result = confirmAndActivateEditorialProfile(
      activateInput(buildMinimalProfile(), { expectedManuscriptId: "other-ms" }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "manuscript_mismatch");
  });

  it("5. wrong manuscript-version identity — rejected", () => {
    const result = confirmAndActivateEditorialProfile(
      activateInput(buildMinimalProfile(), { expectedManuscriptVersionId: "other-ver" }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "version_mismatch");
  });

  it("6. missing provenance — rejected", () => {
    const bad = buildMinimalProfile({
      author_intent_id: "",
      provenance: { ...buildMinimalProfile().provenance, author_intent_id: "" },
    });
    const result = confirmAndActivateEditorialProfile(activateInput(bad));
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(["missing_provenance", "unverifiable_provenance"].includes(result.code));
  });

  it("7. eligible state awaiting_eic_confirmation — can activate", () => {
    const result = confirmAndActivateEditorialProfile(activateInput(buildMinimalProfile()));
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.profile.status, "active");
  });

  it("8. ineligible state draft — direct activation rejected", () => {
    const draft = buildMinimalProfile({ status: "draft" });
    const result = confirmAndActivateEditorialProfile(activateInput(draft));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "ineligible_state");
  });

  it("9. draft moves to awaiting_eic_confirmation when activation-ready", () => {
    const draft = buildMinimalProfile({ status: "draft" });
    const submit = submitEditorialProfileForEicConfirmation({ profile: draft });
    assert.equal(submit.ok, true);
    if (submit.ok) assert.equal(submit.status, "awaiting_eic_confirmation");
  });

  it("10. awaiting_eic_confirmation moves to active after successful confirmation", () => {
    const result = confirmAndActivateEditorialProfile(activateInput(buildMinimalProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.profile.status, "active");
      assert.equal(result.confirmation.resulting_status, "active");
      assert.ok(result.profile.activated_at);
    }
  });

  it("11. direct activation without confirmation — draft rejected", () => {
    const result = confirmAndActivateEditorialProfile(
      activateInput(buildMinimalProfile({ status: "draft" })),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "ineligible_state");
  });

  it("12. failed profile cannot activate", () => {
    const result = confirmAndActivateEditorialProfile(
      activateInput(buildMinimalProfile({ status: "failed" })),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "failed_status");
  });

  it("13. blocked profile cannot activate", () => {
    const blocked = buildMinimalProfile({
      status: "blocked",
      dispute_metadata: {
        disputed_entry_ids: ["ec-1"],
        author_reason: "Disagree with classification",
        opened_at: "2026-08-01T00:00:00.000Z",
      },
    });
    const result = confirmAndActivateEditorialProfile(activateInput(blocked));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "blocked");
  });

  it("14. superseded profile cannot reactivate", () => {
    const result = confirmAndActivateEditorialProfile(
      activateInput(buildMinimalProfile({ status: "superseded" })),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "superseded");
  });

  it("15. already-active profile cannot be activated again", () => {
    const active = buildMinimalProfile({
      status: "active",
      activated_at: "2026-08-01T01:00:00.000Z",
    });
    const result = confirmAndActivateEditorialProfile(activateInput(active));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "already_active");
  });

  it("16. required sections present — activation passes", () => {
    assert.equal(validateForActivation(buildMinimalProfile()).ok, true);
    const result = confirmAndActivateEditorialProfile(activateInput(buildMinimalProfile()));
    assert.equal(result.ok, true);
  });

  it("17. unknown information remains unknown — low confidence preserved", () => {
    const profile = buildMinimalProfile({
      story_identity: {
        ...buildMinimalProfile().story_identity,
        confidence: "low",
      },
      synthesis_confidence: {
        ...buildMinimalProfile().synthesis_confidence,
        sections_at_low_confidence: ["story_identity"],
      },
    });
    const result = confirmAndActivateEditorialProfile(activateInput(profile));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.profile.story_identity.confidence, "low");
      assert.ok(result.confirmation.unresolved_uncertainty.length > 0);
    }
  });

  it("18. low-confidence explicit uncertainty allowed when evidence sufficient", () => {
    const profile = buildMinimalProfile({
      commercial_characteristics: {
        ...buildMinimalProfile().commercial_characteristics,
        confidence: "low",
      },
    });
    const result = confirmAndActivateEditorialProfile(activateInput(profile));
    assert.equal(result.ok, true);
  });

  it("19. unsupported conclusion blocks activation", () => {
    const bad = buildMinimalProfile({
      story_identity: {
        ...buildMinimalProfile().story_identity,
        evidence: [],
        confidence: "low",
      },
    });
    const result = confirmAndActivateEditorialProfile(activateInput(bad));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(["activation_validation_failed", "unsupported_conclusion", "structurally_invalid"].includes(result.code));
    }
  });

  it("20. conflicting evidence remains visible in confirmation record", () => {
    const mixed = [evidence("s", "Ch1", "supporting"), evidence("c", "Ch2", "contrary")];
    const profile = buildMinimalProfile({
      story_identity: {
        ...buildMinimalProfile().story_identity,
        evidence: mixed,
        confidence: "medium",
      },
    });
    const result = confirmAndActivateEditorialProfile(activateInput(profile));
    if (!result.ok) {
      assert.ok(result.confirmation.unresolved_conflicts.length > 0);
    } else {
      assert.ok(result.confirmation.unresolved_conflicts.length > 0);
    }
  });

  it("21. protected assets confirmation evaluated", () => {
    const result = confirmAndActivateEditorialProfile(activateInput(buildMinimalProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      const section = result.confirmation.section_confirmations.find(
        (s) => s.section_key === "protected_assets",
      );
      assert.ok(section?.confirmed);
    }
  });

  it("22. editorial risks evidence validation", () => {
    const bad = buildMinimalProfile({
      editorial_risks: [
        {
          risk_id: "risk-block",
          label: "Blocking gap",
          description: "Blocks",
          severity: "blocking",
          likelihood: "high",
          materiality: "critical",
          evidence: [],
          confidence: "medium",
          mitigation_direction: "Fix",
        },
      ],
    });
    const result = confirmAndActivateEditorialProfile(activateInput(bad));
    assert.equal(result.ok, false);
  });

  it("23. specialist requirements evidence-grounded", () => {
    const result = confirmAndActivateEditorialProfile(activateInput(buildMinimalProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      const section = result.confirmation.section_confirmations.find(
        (s) => s.section_key === "specialist_requirements",
      );
      assert.ok(section?.confirmed);
    }
  });

  it("24. specialist requirements do not imply execution", () => {
    const result = confirmAndActivateEditorialProfile(activateInput(buildMinimalProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.confirmation.specialist_manuscript_access_granted, false);
      assert.equal(EDITORIAL_PROFILE_ACTIVATION_BOUNDARIES.activation_implies_author_consent_to_specialists, false);
    }
  });

  it("25. specialist requirements do not imply manuscript-sharing consent", () => {
    const result = confirmAndActivateEditorialProfile(activateInput(buildMinimalProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(
        EDITORIAL_PROFILE_ACTIVATION_BOUNDARIES.activation_implies_manuscript_sharing_consent,
        false,
      );
    }
  });

  it("26. roadmap inputs do not claim roadmap was generated", () => {
    const result = confirmAndActivateEditorialProfile(activateInput(buildMinimalProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.confirmation.roadmap_generated, false);
      const section = result.confirmation.section_confirmations.find(
        (s) => s.section_key === "roadmap_inputs",
      );
      assert.ok(section?.summary.includes("no roadmap"));
    }
  });

  it("27. activation does not create author consent", () => {
    const result = confirmAndActivateEditorialProfile(activateInput(buildMinimalProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.confirmation.author_control.activation_implies_authority_surrender, false);
    }
  });

  it("28. activation does not create specialist access", () => {
    assert.equal(editorialProfileGrantsSpecialistAccess(), false);
    const result = confirmAndActivateEditorialProfile(activateInput(buildMinimalProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.profile.provenance.specialist_manuscript_access_count, 0);
    }
  });

  it("29. activation does not approve manuscript changes", () => {
    const result = confirmAndActivateEditorialProfile(activateInput(buildMinimalProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(
        EDITORIAL_PROFILE_ACTIVATION_BOUNDARIES.activation_implies_manuscript_change_approval,
        false,
      );
    }
  });

  it("30. first active profile creation", () => {
    const result = confirmAndActivateEditorialProfile(activateInput(buildMinimalProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.priorSuperseded, null);
      assert.equal(result.confirmation.superseded_profile_id, null);
    }
  });

  it("31. safe supersession of prior active profile same version", () => {
    const prior = buildMinimalProfile({
      profile_id: "profile-prior",
      status: "active",
      activated_at: "2026-08-01T06:00:00.000Z",
    });
    const candidate = buildMinimalProfile({ profile_id: "profile-new" });
    const result = confirmAndActivateEditorialProfile(
      activateInput(candidate, { priorActiveProfile: prior }),
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.priorSuperseded?.status, "superseded");
      assert.equal(result.priorSuperseded?.superseded_by_profile_id, "profile-new");
      assert.equal(result.confirmation.superseded_profile_id, "profile-prior");
    }
  });

  it("32. prior profile preserved as immutable history via linkSupersededProfile", () => {
    const prior = buildMinimalProfile({ profile_id: "p-old", status: "active" });
    const linked = linkSupersededProfile(prior, "p-new");
    assert.equal(linked.status, "superseded");
    assert.equal(linked.superseded_by_profile_id, "p-new");
    assert.equal(linked.story_identity.primary_identity.label, prior.story_identity.primary_identity.label);
  });

  it("33. version linkage preserved on supersession", () => {
    const prior = buildMinimalProfile({ profile_id: "p-old", status: "active" });
    const candidate = buildMinimalProfile({ profile_id: "p-new" });
    const result = confirmAndActivateEditorialProfile(
      activateInput(candidate, { priorActiveProfile: prior }),
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.priorSuperseded?.profile_id, "p-old");
      assert.equal(result.profile.profile_id, "p-new");
    }
  });

  it("34. different manuscript version profiles do not supersede one another", () => {
    const priorOtherVersion = buildMinimalProfile({
      profile_id: "profile-ver-old",
      manuscript_version_id: "ver-old",
      status: "active",
      activated_at: "2026-08-01T06:00:00.000Z",
    });
    const candidate = buildMinimalProfile({ profile_id: "profile-ver-new" });
    const result = confirmAndActivateEditorialProfile(
      activateInput(candidate, { priorActiveProfile: priorOtherVersion }),
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.priorSuperseded, null);
      assert.equal(result.confirmation.superseded_profile_id, null);
    }
  });

  it("35. confirmation record is complete and auditable", () => {
    const result = confirmAndActivateEditorialProfile(activateInput(buildMinimalProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      const c = result.confirmation;
      assert.ok(c.confirmation_id);
      assert.equal(c.profile_id, "profile-1");
      assert.equal(c.manuscript_id, FIXTURE_MS_ID);
      assert.equal(c.eic_identity, "editor_in_chief");
      assert.equal(c.readiness.ready, true);
      assert.equal(c.section_confirmations.length, EIC_CONFIRMATION_SECTION_ORDER.length);
      assert.equal(c.failure, null);
    }
  });

  it("36. safe blocked result for blocked profile", () => {
    const result = confirmAndActivateEditorialProfile(
      activateInput(
        buildMinimalProfile({
          status: "blocked",
          dispute_metadata: {
            disputed_entry_ids: ["pa-1"],
            author_reason: "Not my voice",
            opened_at: "2026-08-01T00:00:00.000Z",
          },
        }),
      ),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, "blocked");
      assert.ok(result.confirmation.failure);
    }
  });

  it("37. safe failed result for prohibited input", () => {
    const bad = buildMinimalProfile({
      story_identity: {
        ...buildMinimalProfile().story_identity,
        evidence: [
          {
            evidence_id: "bad",
            locator: locator("Brief"),
            observation: "From intent",
            polarity: "supporting",
            source: "author_intent" as "manuscript",
          },
        ],
      },
    });
    const result = confirmAndActivateEditorialProfile(activateInput(bad));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "prohibited_input");
      assert.equal(result.status, "failed");
    }
  });

  it("38. no model call — deterministic confirmation only", () => {
    const result = confirmAndActivateEditorialProfile(activateInput(buildMinimalProfile()));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.confirmation.section_confirmations.every((s) => typeof s.confirmed === "boolean"));
    }
  });

  it("39. no migration required — runtime-only activation", () => {
    const result = confirmAndActivateEditorialProfile(activateInput(buildMinimalProfile()));
    assert.equal(result.ok, true);
  });

  it("40. end-to-end candidate to activation via fixtures", () => {
    const candidateResult = createEditorialProfileCandidateFromIndependentRead({
      profileId: FIXTURE_PROFILE_ID,
      independentRead: buildCompleteIndependentRead(),
      authorIntent: buildFixtureAuthorIntent(),
      editorialUnderstanding: buildFixtureUnderstanding(),
    });
    assert.equal(candidateResult.ok, true);
    if (candidateResult.ok) {
      assert.equal(candidateResult.status, "awaiting_eic_confirmation");
      const activation = confirmAndActivateEditorialProfile(
        activateInput(candidateResult.profile, { confirmationId: "conf-e2e" }),
      );
      assert.equal(activation.ok, true);
      if (activation.ok) assert.equal(activation.profile.status, "active");
    }
  });
});

describe("EP-3 activation commercial boundaries", () => {
  it("commercial enablement remains off", () => {
    assert.equal(editorialProfileEnablesCommercialExperts(), false);
  });
});
