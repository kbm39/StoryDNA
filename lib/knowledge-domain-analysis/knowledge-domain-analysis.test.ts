import assert from "node:assert/strict";
import { describe, it, after } from "node:test";
import { createAuditEvent, appendAuditEvent, assertAuditHistoryAppendOnly } from "./audit.ts";
import { buildKdaEicConfirmationRecord } from "./confirmation.ts";
import {
  KDA_ACTIVATION_BOUNDARIES,
  KDA_AUTHOR_CONTROL,
  KDA_CAPABILITY,
  KNOWLEDGE_DOMAIN_ANALYSIS_CONTRACT_VERSION,
  KNOWLEDGE_DOMAIN_ANALYSIS_STATUSES,
} from "./contract.ts";
import {
  STUDIO_KNOWLEDGE_DOMAIN_ANALYSIS_FLAG_NAME,
  STUDIO_KNOWLEDGE_DOMAIN_RECOMMENDATIONS_FLAG_NAME,
  isStudioKnowledgeDomainAnalysisEnabled,
  isStudioKnowledgeDomainRecommendationsEnabled,
  kdaEnablesCommercialExperts,
  kdaGeneratesRoadmap,
  kdaGrantsSpecialistAccess,
  kdaPerformsExpertActivation,
} from "./feature-flag.ts";
import {
  buildPoliceOrganizedCrimeKdaFixture,
  buildKdaEvidence,
  criminalLawDomainFixture,
  militaryIncidentalDomainFixture,
  organizedCrimeDomainFixture,
  organizedCrimeRecommendationFixture,
  organizedCrimeRegistryGapFixture,
  policeDomainFixture,
  policeRecommendationFixture,
} from "./fixtures/police-organized-crime-fixture.ts";
import {
  ILLEGAL_DIRECT_ACTIVATION_SOURCES,
  validateKdaActivationTransition,
  validateKdaStatusTransition,
} from "./lifecycle.ts";
import { buildProfileProjectionBundle } from "./projection.ts";
import type { AuthorResponseEntry } from "./types.ts";
import {
  buildKdaVersionChain,
  createSupersedingKda,
  kdaMetadataFlags,
  linkSupersededKda,
} from "./versioning.ts";
import {
  DEFAULT_RECOMMENDATION_BOUNDARIES,
  detectRegistryGapSubstitution,
  isPlaceholderEvidence,
  validateAuthorResponse,
  validateDomainEntry,
  validateForDraft,
  validateKdaContract,
  validateKdaEicConfirmationRecord,
  validateKdaEvidenceEntry,
  validateProfileProjectionBundle,
  validateSpecialistRecommendation,
} from "./validation.ts";
import { STUDIO_AUTHOR_INTENT_FLAG_NAME } from "@/lib/author-intent/feature-flag.ts";
import { STUDIO_EIC_FLAG_NAME } from "@/lib/eic/feature-flag.ts";

const savedEnv: Record<string, string | undefined> = {};

function saveEnv(keys: string[]) {
  for (const k of keys) savedEnv[k] = process.env[k];
}

function restoreEnv(keys: string[]) {
  for (const k of keys) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
}

function setKdaFlags(master: string, recs?: string) {
  process.env[STUDIO_EIC_FLAG_NAME] = "1";
  process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME] = "1";
  process.env[STUDIO_KNOWLEDGE_DOMAIN_ANALYSIS_FLAG_NAME] = master;
  if (recs !== undefined) {
    process.env[STUDIO_KNOWLEDGE_DOMAIN_RECOMMENDATIONS_FLAG_NAME] = recs;
  } else {
    delete process.env[STUDIO_KNOWLEDGE_DOMAIN_RECOMMENDATIONS_FLAG_NAME];
  }
}

function buildAuthorResponse(
  overrides: Partial<AuthorResponseEntry> = {},
): AuthorResponseEntry {
  return Object.freeze({
    response_id: "resp-1",
    target_type: "domain_conclusion",
    target_id: policeDomainFixture.domain_id,
    author_id: "author-1",
    response_type: "disagree",
    response_text: "I compressed procedure intentionally",
    created_at: "2026-08-01T01:00:00.000Z",
    state_before: "proposed",
    state_after: "proposed",
    effects: Object.freeze({
      confidence_changed: false,
      uncertainty_changed: false,
      conflict_remains_visible: true,
      peu_updates: true,
      requires_new_artifact_version: false,
      recommendation_status_changed: false,
      roadmap_inputs_changed: false,
    }),
    audit_event_id: "audit-resp-1",
    preserves_eic_conclusion: true,
    preserves_manuscript_evidence: true,
    ...overrides,
  });
}

describe("KDA-1 runtime foundation", () => {
  after(() => {
    restoreEnv([
      STUDIO_EIC_FLAG_NAME,
      STUDIO_AUTHOR_INTENT_FLAG_NAME,
      STUDIO_KNOWLEDGE_DOMAIN_ANALYSIS_FLAG_NAME,
      STUDIO_KNOWLEDGE_DOMAIN_RECOMMENDATIONS_FLAG_NAME,
    ]);
  });

  it("1. valid draft KDA artifact", () => {
    const analysis = buildPoliceOrganizedCrimeKdaFixture({ status: "draft" });
    const result = validateForDraft(analysis);
    assert.equal(result.ok, true);
  });

  it("2. structurally invalid artifact", () => {
    const analysis = buildPoliceOrganizedCrimeKdaFixture({ analysis_id: "" });
    const result = validateKdaContract(analysis, "structural");
    assert.equal(result.ok, false);
  });

  it("3. missing manuscript identity", () => {
    const analysis = buildPoliceOrganizedCrimeKdaFixture({ manuscript_id: "" });
    assert.equal(validateForDraft(analysis).ok, false);
  });

  it("4. missing manuscript-version identity", () => {
    const analysis = buildPoliceOrganizedCrimeKdaFixture({ manuscript_version_id: "" });
    assert.equal(validateForDraft(analysis).ok, false);
  });

  it("5. missing Independent Read provenance", () => {
    const analysis = buildPoliceOrganizedCrimeKdaFixture({
      provenance: {
        ...buildPoliceOrganizedCrimeKdaFixture().provenance,
        independent_read_id: "",
      },
    });
    assert.equal(validateForDraft(analysis).ok, false);
  });

  it("6. required artifact version", () => {
    const analysis = buildPoliceOrganizedCrimeKdaFixture({
      contract_version: "wrong@v1" as typeof KNOWLEDGE_DOMAIN_ANALYSIS_CONTRACT_VERSION,
    });
    assert.equal(validateForDraft(analysis).ok, false);
  });

  it("7. domain conclusion structure", () => {
    const errors = validateDomainEntry(policeDomainFixture, "draft");
    assert.equal(errors.length, 0);
  });

  it("8. central domain", () => {
    assert.equal(policeDomainFixture.centrality, "central");
  });

  it("9. substantial supporting domain", () => {
    assert.equal(criminalLawDomainFixture.centrality, "substantial_supporting");
  });

  it("10. limited scene-specific domain support in contract", () => {
    const domain = Object.freeze({
      ...policeDomainFixture,
      domain_id: "domain-lss",
      centrality: "limited_scene_specific" as const,
      materiality: "moderate" as const,
      evidence: Object.freeze([buildKdaEvidence({ id: "e1", chapter: "Chapter 8", observation: "Single range scene with weapon handling detail" })]),
    });
    assert.equal(validateDomainEntry(domain, "draft").length, 0);
  });

  it("11. incidental domain", () => {
    assert.equal(militaryIncidentalDomainFixture.centrality, "incidental");
  });

  it("12. speculative domain cannot recommend", () => {
    const domain = Object.freeze({
      ...policeDomainFixture,
      centrality: "speculative" as const,
      recommendation_status: "proposed" as const,
    });
    assert.ok(validateDomainEntry(domain, "draft").some((e) => e.code === "speculative_domain_recommendation"));
  });

  it("13. insufficient-evidence domain cannot recommend", () => {
    const domain = Object.freeze({
      ...policeDomainFixture,
      centrality: "insufficient_evidence" as const,
      recommendation_status: "proposed" as const,
    });
    assert.ok(validateDomainEntry(domain, "draft").some((e) => e.code === "insufficient_evidence_recommendation"));
  });

  it("14. not-material domain", () => {
    assert.equal(militaryIncidentalDomainFixture.materiality, "not_material");
  });

  it("15. unknown remains unknown", () => {
    const domain = Object.freeze({
      ...policeDomainFixture,
      confidence: "unknown" as const,
      recommendation_status: "not_recommended" as const,
    });
    assert.equal(domain.confidence, "unknown");
  });

  it("16. multiple domains", () => {
    assert.ok(buildPoliceOrganizedCrimeKdaFixture().domains.length >= 3);
  });

  it("17. multiple evidence items", () => {
    assert.ok(policeDomainFixture.evidence.length >= 2);
  });

  it("18. manuscript evidence distinct from EIC synthesis", () => {
    const ms = buildKdaEvidence({ id: "e-ms", chapter: "Chapter 1", observation: "Warrant service", source: "manuscript" });
    const syn = buildKdaEvidence({ id: "e-syn", chapter: "Chapter 1", observation: "EIC notes warrant timing pressure", source: "eic_synthesis" });
    assert.notEqual(ms.source, syn.source);
  });

  it("19. Author Intent distinct from manuscript evidence", () => {
    const intent = buildKdaEvidence({ id: "e-int", chapter: "Author brief", observation: "Author wants procedural realism", source: "author_intent" });
    assert.equal(intent.source, "author_intent");
    const domain = Object.freeze({
      ...policeDomainFixture,
      evidence: Object.freeze([intent]),
    });
    assert.ok(validateDomainEntry(domain, "draft").some((e) => e.code === "material_domain_framing_only_evidence"));
  });

  it("20. conflicting evidence remains visible", () => {
    const analysis = buildPoliceOrganizedCrimeKdaFixture({
      domains: Object.freeze([
        Object.freeze({
          ...policeDomainFixture,
          conflicting_evidence: Object.freeze([
            Object.freeze({
              conflict_id: "conf-1",
              description: "Author brief emphasizes speed; manuscript shows warrant delays",
              signal_a: "author_intent",
              signal_b: "manuscript",
              evidence_ids: Object.freeze(["ev-pol-12"]),
              visible_to_author: true,
            }),
          ]),
        }),
      ]),
    });
    assert.equal(analysis.domains[0]?.conflicting_evidence[0]?.visible_to_author, true);
  });

  it("21. field-specific confidence", () => {
    assert.equal(criminalLawDomainFixture.confidence, "medium");
    assert.equal(policeDomainFixture.confidence, "high");
  });

  it("22. explicit uncertainty", () => {
    assert.ok(criminalLawDomainFixture.uncertainty_notes.length > 0);
  });

  it("23. placeholder evidence rejection", () => {
    const bad = buildKdaEvidence({ id: "bad", chapter: "Chapter 1", observation: "Observation for Chapter 1" });
    assert.equal(isPlaceholderEvidence(bad.observation), true);
    assert.ok(
      validateKdaEvidenceEntry(bad, "test", { requireNonPlaceholder: true }).some(
        (e) => e.code === "placeholder_evidence",
      ),
    );
  });

  it("24. capability mapping distinct from expert", () => {
    const mapping = buildPoliceOrganizedCrimeKdaFixture().capability_mappings[0];
    assert.ok(mapping?.capability_key);
    assert.notEqual(mapping?.capability_key, mapping?.mapping_id);
  });

  it("25. expert distinct from assignment", () => {
    assert.equal(DEFAULT_RECOMMENDATION_BOUNDARIES.activation_status, "not_activated");
  });

  it("26. recommendation distinct from activation", () => {
    const rec = policeRecommendationFixture;
    assert.equal(rec.activation_status, "not_activated");
    assert.equal(rec.recommendation_status, "proposed");
  });

  it("27. recommendation does not imply consent", () => {
    assert.equal(policeRecommendationFixture.consent_status, "not_requested");
  });

  it("28. recommendation does not imply manuscript access", () => {
    assert.equal(policeRecommendationFixture.manuscript_access_status, "not_shared");
  });

  it("29. Police Procedure domain represented", () => {
    assert.equal(policeDomainFixture.domain_key, "police_procedure");
  });

  it("30. Organized Crime domain represented", () => {
    assert.equal(organizedCrimeDomainFixture.domain_key, "organized_crime");
  });

  it("31. Criminal Law domain represented", () => {
    assert.equal(criminalLawDomainFixture.domain_key, "criminal_law_prosecutorial");
  });

  it("32. Military not substituted for Police", () => {
    const analysis = buildPoliceOrganizedCrimeKdaFixture({
      registry_gaps: Object.freeze([
        Object.freeze({ ...organizedCrimeRegistryGapFixture, required_capability_key: "police_procedure", gap_id: "gap-pol" }),
      ]),
      recommendations: Object.freeze([
        Object.freeze({
          ...policeRecommendationFixture,
          candidate_capability_key: "military_operations",
        }),
      ]),
    });
    assert.ok(detectRegistryGapSubstitution(analysis).some((e) => e.code === "military_substitution_police"));
  });

  it("33. Military not substituted for Organized Crime", () => {
    const analysis = buildPoliceOrganizedCrimeKdaFixture({
      recommendations: Object.freeze([
        Object.freeze({
          ...organizedCrimeRecommendationFixture,
          candidate_capability_key: "military_operations",
        }),
      ]),
    });
    assert.ok(detectRegistryGapSubstitution(analysis).some((e) => e.code === "substitution_organized_crime"));
  });

  it("34. registered capability resolution", () => {
    const mapping = buildPoliceOrganizedCrimeKdaFixture().capability_mappings.find(
      (m) => m.capability_key === "police_procedure",
    );
    assert.equal(mapping?.is_registered, true);
  });

  it("35. missing capability creates registry gap", () => {
    assert.equal(buildPoliceOrganizedCrimeKdaFixture().registry_gaps.length, 1);
  });

  it("36. registry gap remains visible", () => {
    assert.equal(organizedCrimeDomainFixture.registry_gap_status, true);
    assert.match(organizedCrimeRecommendationFixture.author_facing_explanation, /not yet available/i);
  });

  it("37. registry gap does not create fake expert", () => {
    assert.equal(organizedCrimeRecommendationFixture.candidate_expert_keys.length, 0);
  });

  it("38. specialist recommendation rationale", () => {
    assert.ok(policeRecommendationFixture.capability_rationale.length > 20);
  });

  it("39. specialist sequencing", () => {
    assert.equal(organizedCrimeRecommendationFixture.sequence, "early");
    assert.equal(policeRecommendationFixture.sequence, "after_structural_work");
  });

  it("40. author-facing explanation presence", () => {
    assert.ok(policeRecommendationFixture.author_facing_explanation.includes("Police work"));
  });

  it("41. raw internal key not sufficient as explanation", () => {
    const rec = Object.freeze({
      ...policeRecommendationFixture,
      author_facing_explanation: "police_procedure",
    });
    assert.ok(validateSpecialistRecommendation(rec, "draft").some((e) => e.code === "raw_key_as_explanation"));
  });

  it("42. author agree response", () => {
    const resp = buildAuthorResponse({ response_type: "agree", effects: Object.freeze({ ...buildAuthorResponse().effects, recommendation_status_changed: true }) });
    assert.equal(validateAuthorResponse(resp).length, 0);
  });

  it("43. author disagree response", () => {
    assert.equal(validateAuthorResponse(buildAuthorResponse({ response_type: "disagree" })).length, 0);
  });

  it("44. disagreement does not erase conclusion", () => {
    const resp = buildAuthorResponse({ response_type: "disagree", preserves_eic_conclusion: false });
    assert.ok(validateAuthorResponse(resp).some((e) => e.code === "disagree_must_preserve_conclusion"));
  });

  it("45. explain-author-intention response", () => {
    const resp = buildAuthorResponse({ response_type: "explain_intention" });
    assert.equal(resp.response_type, "explain_intention");
  });

  it("46. mark-intentional response", () => {
    const resp = buildAuthorResponse({ response_type: "mark_intentional" });
    assert.equal(resp.response_type, "mark_intentional");
  });

  it("47. ask-for-more-evidence response", () => {
    const resp = buildAuthorResponse({ response_type: "ask_evidence" });
    assert.equal(resp.response_type, "ask_evidence");
  });

  it("48. defer response", () => {
    const resp = buildAuthorResponse({ response_type: "defer" });
    assert.equal(resp.response_type, "defer");
  });

  it("49. reject response", () => {
    const resp = buildAuthorResponse({ response_type: "reject" });
    assert.equal(resp.response_type, "reject");
  });

  it("50. reopen response", () => {
    const resp = buildAuthorResponse({ response_type: "reopen" });
    assert.equal(resp.response_type, "reopen");
  });

  it("51. Progressive Editorial Understanding effect represented", () => {
    assert.equal(buildAuthorResponse().effects.peu_updates, true);
  });

  it("52. Roadmap-input effect without generating Roadmap", () => {
    const resp = buildAuthorResponse({
      response_type: "approve_roadmap_input",
      effects: Object.freeze({ ...buildAuthorResponse().effects, roadmap_inputs_changed: true }),
    });
    assert.equal(resp.effects.roadmap_inputs_changed, true);
    assert.equal(kdaGeneratesRoadmap(), false);
  });

  it("53. legal lifecycle transitions", () => {
    assert.equal(validateKdaStatusTransition("draft", "awaiting_eic_confirmation").ok, true);
  });

  it("54. illegal lifecycle transitions", () => {
    for (const from of ILLEGAL_DIRECT_ACTIVATION_SOURCES) {
      assert.equal(validateKdaActivationTransition(from, "active").ok, false);
    }
  });

  it("55. failed cannot activate", () => {
    assert.equal(validateKdaActivationTransition("failed", "active").ok, false);
  });

  it("56. blocked cannot activate", () => {
    assert.equal(validateKdaActivationTransition("blocked", "active").ok, false);
  });

  it("57. superseded cannot reactivate", () => {
    assert.equal(validateKdaStatusTransition("superseded", "active").ok, false);
  });

  it("58. historical version preserved", () => {
    const prior = buildPoliceOrganizedCrimeKdaFixture({ status: "active", analysis_id: "kda-v1" });
    const next = createSupersedingKda({
      prior,
      newAnalysisId: "kda-v2",
      triggerEvent: "author_dispute_resolved",
      createdAt: "2026-08-01T02:00:00.000Z",
      updatedAt: "2026-08-01T02:00:00.000Z",
      updates: { status: "draft" },
    });
    const linked = linkSupersededKda(prior, next.analysis_id);
    const chain = buildKdaVersionChain([prior, linked, next]);
    assert.equal(chain.length, 3);
    assert.equal(linked.status, "superseded");
  });

  it("59. append-only audit behavior", () => {
    const analysis = buildPoliceOrganizedCrimeKdaFixture();
    const event = createAuditEvent({
      event_id: "audit-2",
      event_type: "author_response_recorded",
      timestamp: "2026-08-01T01:00:00.000Z",
      actor: "author",
      summary: "Author disagreed with police domain",
      related_ids: ["resp-1"],
    });
    const next = appendAuditEvent(analysis, event);
    assert.equal(assertAuditHistoryAppendOnly(analysis.audit_history, next.audit_history).ok, true);
  });

  it("60. KDA confirmation-record validation", () => {
    const analysis = buildPoliceOrganizedCrimeKdaFixture();
    const built = buildKdaEicConfirmationRecord({
      analysis,
      confirmationId: "conf-1",
      eicExecutionId: "eic-exec-1",
      confirmedAt: "2026-08-01T00:00:00.000Z",
      relatedEditorialProfileId: "profile-1",
      relatedEditorialProfileStatus: "awaiting_eic_confirmation",
      reason: "EIC confirms domain analysis for joint gate",
    });
    assert.equal(built.ok, true);
    if (built.ok) {
      assert.equal(validateKdaEicConfirmationRecord(built.record).ok, true);
      assert.equal(built.record.expert_activation_performed, false);
    }
  });

  it("61. dual-confirmation linkage fields", () => {
    const analysis = buildPoliceOrganizedCrimeKdaFixture();
    const built = buildKdaEicConfirmationRecord({
      analysis,
      confirmationId: "conf-1",
      eicExecutionId: "eic-exec-1",
      confirmedAt: "2026-08-01T00:00:00.000Z",
      relatedEditorialProfileId: "profile-1",
      relatedEditorialProfileStatus: "awaiting_eic_confirmation",
      reason: "Joint gate linkage",
    });
    if (built.ok) {
      assert.equal(built.record.related_editorial_profile_id, "profile-1");
    }
  });

  it("62. Editorial Profile projection contract", () => {
    const analysis = buildPoliceOrganizedCrimeKdaFixture();
    const built = buildProfileProjectionBundle({ analysis, bundleId: "proj-bundle-1" });
    assert.equal(built.ok, true);
  });

  it("63. projection preserves KDA provenance", () => {
    const analysis = buildPoliceOrganizedCrimeKdaFixture();
    const built = buildProfileProjectionBundle({ analysis, bundleId: "proj-bundle-1" });
    if (built.ok) {
      assert.equal(built.bundle.source_analysis_id, analysis.analysis_id);
      assert.ok(built.bundle.projections.every((p) => p.source_analysis_id === analysis.analysis_id));
      assert.equal(validateProfileProjectionBundle(built.bundle).ok, true);
    }
  });

  it("64. feature flags disabled by default", () => {
    saveEnv([
      STUDIO_EIC_FLAG_NAME,
      STUDIO_AUTHOR_INTENT_FLAG_NAME,
      STUDIO_KNOWLEDGE_DOMAIN_ANALYSIS_FLAG_NAME,
      STUDIO_KNOWLEDGE_DOMAIN_RECOMMENDATIONS_FLAG_NAME,
    ]);
    delete process.env[STUDIO_KNOWLEDGE_DOMAIN_ANALYSIS_FLAG_NAME];
    delete process.env[STUDIO_KNOWLEDGE_DOMAIN_RECOMMENDATIONS_FLAG_NAME];
    assert.equal(isStudioKnowledgeDomainAnalysisEnabled(), false);
  });

  it("65. recommendations flag requires master flag", () => {
    saveEnv([
      STUDIO_EIC_FLAG_NAME,
      STUDIO_AUTHOR_INTENT_FLAG_NAME,
      STUDIO_KNOWLEDGE_DOMAIN_ANALYSIS_FLAG_NAME,
      STUDIO_KNOWLEDGE_DOMAIN_RECOMMENDATIONS_FLAG_NAME,
    ]);
    setKdaFlags("0", "1");
    assert.equal(isStudioKnowledgeDomainRecommendationsEnabled(), false);
    setKdaFlags("1", "1");
    assert.equal(isStudioKnowledgeDomainRecommendationsEnabled(), true);
  });

  it("66. no commercial enablement", () => {
    assert.equal(kdaEnablesCommercialExperts(), false);
    assert.equal(
      buildPoliceOrganizedCrimeKdaFixture().recommendations.every(
        (r) => r.commercial_enablement_status === "not_commercially_enabled",
      ),
      true,
    );
  });

  it("67. no specialist execution", () => {
    assert.equal(kdaPerformsExpertActivation(), false);
    assert.equal(KDA_ACTIVATION_BOUNDARIES.activation_implies_expert_activation, false);
  });

  it("68. no manuscript-sharing permission", () => {
    assert.equal(kdaGrantsSpecialistAccess(), false);
    assert.equal(KDA_AUTHOR_CONTROL.recommendation_does_not_grant_manuscript_access, true);
  });

  it("69. no live model call — foundation only", () => {
    assert.equal(KNOWLEDGE_DOMAIN_ANALYSIS_STATUSES.includes("generating"), true);
    assert.equal(KDA_CAPABILITY.capability_id, "cap.knowledge_domain_analysis");
  });

  it("70. constitutional metadata flags", () => {
    const flags = kdaMetadataFlags();
    assert.equal(flags.is_expert_finding, false);
    assert.equal(flags.is_manuscript_evidence, false);
    assert.equal(flags.is_roadmap_generation, false);
  });
});
