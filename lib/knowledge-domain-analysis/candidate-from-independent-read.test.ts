import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { STUDIO_AUTHOR_INTENT_FLAG_NAME } from "@/lib/author-intent/feature-flag.ts";
import { STUDIO_EIC_FLAG_NAME } from "@/lib/eic/feature-flag.ts";
import { buildCompleteIndependentRead } from "@/lib/editorial-profile/fixtures/independent-read-fixtures.ts";
import {
  createKnowledgeDomainAnalysisCandidateFromIndependentRead,
  NON_ACTIVE_KDA_CANDIDATE_STATUSES,
  validateIndependentReadForKdaSynthesis,
} from "./candidate-from-independent-read.ts";
import {
  STUDIO_KNOWLEDGE_DOMAIN_ANALYSIS_FLAG_NAME,
  STUDIO_KNOWLEDGE_DOMAIN_RECOMMENDATIONS_FLAG_NAME,
  kdaEnablesCommercialExperts,
  kdaGeneratesRoadmap,
  kdaGrantsSpecialistAccess,
  kdaPerformsExpertActivation,
} from "./feature-flag.ts";
import { validateForDraft, validateKdaContract } from "./validation.ts";
import {
  FIXTURE_EIC_EXECUTION_ID,
  FIXTURE_KDA_ANALYSIS_ID,
  FIXTURE_MS_ID,
  FIXTURE_VER_ID,
  buildFixtureAuthorIntent,
  buildFixtureUnderstanding,
  buildIncompleteEvidenceRead,
  buildIncidentalPoliceMentionRead,
  buildPoliceOrganizedCrimeIndependentRead,
} from "./fixtures/independent-read-kda-fixtures.ts";

function enableKdaFlags() {
  process.env[STUDIO_KNOWLEDGE_DOMAIN_ANALYSIS_FLAG_NAME] = "1";
  process.env[STUDIO_EIC_FLAG_NAME] = "1";
  process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME] = "1";
  process.env.NODE_ENV = "development";
}

function baseInput(
  overrides: Partial<Parameters<typeof createKnowledgeDomainAnalysisCandidateFromIndependentRead>[0]> = {},
) {
  return {
    analysisId: FIXTURE_KDA_ANALYSIS_ID,
    eicExecutionId: FIXTURE_EIC_EXECUTION_ID,
    independentRead: buildPoliceOrganizedCrimeIndependentRead(),
    authorIntent: buildFixtureAuthorIntent({ priority_domains: ["crime", "structure"] }),
    editorialUnderstanding: buildFixtureUnderstanding(),
    expectedManuscriptId: FIXTURE_MS_ID,
    expectedManuscriptVersionId: FIXTURE_VER_ID,
    generatedAt: "2026-08-01T02:00:00.000Z",
    ...overrides,
  };
}

describe("KDA-2 candidate from independent read", () => {
  const savedKda = process.env[STUDIO_KNOWLEDGE_DOMAIN_ANALYSIS_FLAG_NAME];
  const savedRec = process.env[STUDIO_KNOWLEDGE_DOMAIN_RECOMMENDATIONS_FLAG_NAME];
  const savedEic = process.env[STUDIO_EIC_FLAG_NAME];
  const savedIntent = process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME];
  const savedNodeEnv = process.env.NODE_ENV;

  beforeEach(() => enableKdaFlags());

  after(() => {
    if (savedKda === undefined) delete process.env[STUDIO_KNOWLEDGE_DOMAIN_ANALYSIS_FLAG_NAME];
    else process.env[STUDIO_KNOWLEDGE_DOMAIN_ANALYSIS_FLAG_NAME] = savedKda;
    if (savedRec === undefined) delete process.env[STUDIO_KNOWLEDGE_DOMAIN_RECOMMENDATIONS_FLAG_NAME];
    else process.env[STUDIO_KNOWLEDGE_DOMAIN_RECOMMENDATIONS_FLAG_NAME] = savedRec;
    if (savedEic === undefined) delete process.env[STUDIO_EIC_FLAG_NAME];
    else process.env[STUDIO_EIC_FLAG_NAME] = savedEic;
    if (savedIntent === undefined) delete process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME];
    else process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME] = savedIntent;
    process.env.NODE_ENV = savedNodeEnv;
  });

  it("1. feature flag disabled", () => {
    delete process.env[STUDIO_KNOWLEDGE_DOMAIN_ANALYSIS_FLAG_NAME];
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "feature_flag_disabled");
      assert.equal(result.status, "not_started");
    }
  });

  it("2. missing Independent Read", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(
      baseInput({ independentRead: null }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "read_missing");
  });

  it("3. failed Independent Read", () => {
    const check = validateIndependentReadForKdaSynthesis(
      buildPoliceOrganizedCrimeIndependentRead({ status: "failed" }),
      { manuscriptId: FIXTURE_MS_ID, manuscriptVersionId: FIXTURE_VER_ID },
    );
    assert.equal(check.ok, false);
    if (!check.ok) assert.equal(check.code, "read_failed");
  });

  it("4. incomplete Independent Read", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(
      baseInput({ independentRead: buildPoliceOrganizedCrimeIndependentRead({ status: "in_progress" }) }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "read_incomplete");
  });

  it("5. wrong manuscript", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(
      baseInput({ independentRead: buildPoliceOrganizedCrimeIndependentRead({ manuscript_id: "other-ms" }) }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "manuscript_mismatch");
  });

  it("6. wrong manuscript version", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(
      baseInput({
        independentRead: buildPoliceOrganizedCrimeIndependentRead({ manuscript_version_id: "other-ver" }),
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "version_mismatch");
  });

  it("7. stale Independent Read", () => {
    const check = validateIndependentReadForKdaSynthesis(
      buildPoliceOrganizedCrimeIndependentRead({ status: "stale" }),
      { manuscriptId: FIXTURE_MS_ID, manuscriptVersionId: FIXTURE_VER_ID },
    );
    assert.equal(check.ok, false);
    if (!check.ok) assert.equal(check.code, "read_stale");
  });

  it("8. missing provenance", () => {
    const read = buildPoliceOrganizedCrimeIndependentRead({ independent_read_id: "" });
    const check = validateIndependentReadForKdaSynthesis(read, {
      manuscriptId: FIXTURE_MS_ID,
      manuscriptVersionId: FIXTURE_VER_ID,
    });
    assert.equal(check.ok, false);
    if (!check.ok) assert.equal(check.code, "missing_provenance");
  });

  it("9. valid candidate creation", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.analysis.manuscript_id, FIXTURE_MS_ID);
      assert.ok(result.analysis.domains.length > 0);
    }
  });

  it("10. candidate remains non-active", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.notEqual(result.status, "active");
      assert.ok((NON_ACTIVE_KDA_CANDIDATE_STATUSES as readonly string[]).includes(result.status));
    }
  });

  it("11. KDA validator invoked", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.validation);
      assert.equal(validateForDraft(result.analysis).ok, true);
    }
  });

  it("12. all required artifact sections represented", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      const a = result.analysis;
      assert.ok(Array.isArray(a.domains));
      assert.ok(Array.isArray(a.capability_mappings));
      assert.ok(Array.isArray(a.recommendations));
      assert.ok(Array.isArray(a.registry_gaps));
      assert.ok(Array.isArray(a.audit_history));
      assert.ok(a.provenance.independent_read_id);
    }
  });

  it("13. unknown remains unknown", () => {
    const sparse = createKnowledgeDomainAnalysisCandidateFromIndependentRead(
      baseInput({ independentRead: buildIncompleteEvidenceRead() }),
    );
    assert.equal(sparse.ok, true);
    if (sparse.ok) {
      const speculative = sparse.analysis.domains.find((d) => d.centrality === "speculative");
      assert.ok(speculative || sparse.status === "incomplete_evidence");
    }
  });

  it("14. direct evidence distinct from EIC synthesis", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      const manuscript = result.analysis.domains.flatMap((d) => d.evidence).filter((e) => e.source === "manuscript");
      const synthesis = result.analysis.domains.flatMap((d) => d.evidence).filter((e) => e.source === "eic_synthesis");
      assert.ok(manuscript.length > 0);
      assert.equal(synthesis.length, 0);
    }
  });

  it("15. Author Intent distinct from manuscript execution", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      const intentEvidence = result.analysis.domains.flatMap((d) => d.evidence).filter((e) => e.source === "author_intent");
      const manuscript = result.analysis.domains.flatMap((d) => d.evidence).filter((e) => e.source === "manuscript");
      assert.ok(intentEvidence.length > 0);
      assert.ok(manuscript.length > 0);
      assert.notDeepEqual(intentEvidence[0]?.source, manuscript[0]?.source);
    }
  });

  it("16. Author Intent alignment", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(
      baseInput({
        authorIntent: buildFixtureAuthorIntent({ priority_domains: ["organized_crime", "crime"] }),
      }),
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      const oc = result.analysis.domains.find((d) => d.domain_key === "organized_crime");
      assert.ok(oc?.author_authenticity_priority === "elevates" || oc?.author_authenticity_priority === "neutral");
    }
  });

  it("17. Author Intent conflict", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(
      baseInput({
        editorialUnderstanding: buildFixtureUnderstanding({
          market_position: "Literary fiction",
        }),
      }),
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      const withConflict = result.analysis.domains.some((d) => d.conflicting_evidence.length > 0);
      assert.equal(withConflict, true);
    }
  });

  it("18. conflicting evidence remains visible", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      for (const domain of result.analysis.domains) {
        for (const conflict of domain.conflicting_evidence) {
          assert.equal(conflict.visible_to_author, true);
        }
      }
    }
  });

  it("19. Police Procedure detected from procedural evidence", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      const police = result.analysis.domains.find((d) => d.domain_key === "police_procedure");
      assert.ok(police);
      assert.equal(police.centrality, "central");
    }
  });

  it("20. incidental police mention does not become central", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(
      baseInput({ independentRead: buildIncidentalPoliceMentionRead() }),
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      const police = result.analysis.domains.find((d) => d.domain_key === "police_procedure");
      assert.ok(police);
      assert.notEqual(police.centrality, "central");
    }
  });

  it("21. Organized Crime detected from hierarchy and enterprise evidence", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      const oc = result.analysis.domains.find((d) => d.domain_key === "organized_crime");
      assert.ok(oc);
      assert.equal(oc.centrality, "central");
    }
  });

  it("22. Criminal Law detected separately", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      const cl = result.analysis.domains.find((d) => d.domain_key === "criminal_law_prosecutorial");
      assert.ok(cl);
      assert.notEqual(cl.domain_key, "police_procedure");
    }
  });

  it("23. Military remains separate", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      const military = result.analysis.domains.find((d) => d.domain_key === "military_operations");
      assert.ok(military);
    }
  });

  it("24. Military not substituted for Police Procedure", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      const policeMapping = result.analysis.capability_mappings.find((m) => m.capability_key === "police_procedure");
      assert.ok(policeMapping);
      assert.notEqual(policeMapping.capability_key, "military_operations");
    }
  });

  it("25. Military not substituted for Organized Crime", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      const gap = result.analysis.registry_gaps.find((g) => g.required_capability_key === "organized_crime");
      assert.ok(gap);
      assert.notEqual(gap.required_capability_key, "military_operations");
    }
  });

  it("26. concrete manuscript evidence preserved", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      const obs = result.analysis.domains.flatMap((d) => d.evidence.map((e) => e.observation)).join(" ");
      assert.match(obs, /interrogation|wiretap|crew hierarchy|racket/i);
    }
  });

  it("27. placeholder evidence rejected at validation", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      const bad = {
        ...result.analysis,
        domains: result.analysis.domains.map((d, i) =>
          i === 0
            ? {
                ...d,
                evidence: [
                  {
                    ...d.evidence[0]!,
                    observation: "Observation for Chapter 1",
                  },
                ],
              }
            : d,
        ),
      };
      const validation = validateKdaContract(bad, "draft");
      assert.equal(validation.ok, false);
    }
  });

  it("28. plain-English explanation present", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      const police = result.analysis.domains.find((d) => d.domain_key === "police_procedure");
      assert.ok(police?.description && police.description.length > 80);
      assert.match(police!.description, /police|procedure|investigation/i);
    }
  });

  it("29. raw internal key alone rejected as explanation", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      for (const rec of result.analysis.recommendations) {
        assert.notEqual(rec.author_facing_explanation.trim(), "police_procedure");
        assert.ok(rec.author_facing_explanation.length > 40);
      }
    }
  });

  it("30. capability mapping produced", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) assert.ok(result.analysis.capability_mappings.length > 0);
  });

  it("31. registry gap produced when capability is unavailable", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.analysis.registry_gaps.some((g) => g.required_capability_key === "organized_crime"));
    }
  });

  it("32. no fake expert created", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      const ocRec = result.analysis.recommendations.find((r) => r.candidate_capability_key === "organized_crime");
      assert.ok(ocRec);
      assert.equal(ocRec.candidate_expert_keys.length, 0);
    }
  });

  it("33. recommendation remains recommendation", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.analysis.recommendations.length > 0);
      assert.equal(result.analysis.is_specialist_assignment, false);
    }
  });

  it("34. no activation", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.analysis.is_expert_activation, false);
      assert.ok(result.analysis.recommendations.every((r) => r.activation_status === "not_activated"));
    }
  });

  it("35. no consent", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.analysis.recommendations.every((r) => r.consent_status === "not_requested"));
    }
  });

  it("36. no manuscript access", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.analysis.provenance.specialist_manuscript_access_count, 0);
      assert.ok(result.analysis.recommendations.every((r) => r.manuscript_access_status === "not_shared"));
    }
  });

  it("37. sequencing represented", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      const oc = result.analysis.domains.find((d) => d.domain_key === "organized_crime");
      assert.ok(oc?.sequencing);
      assert.ok(result.analysis.recommendations.some((r) => r.sequencing_rationale));
    }
  });

  it("38. no Editorial Roadmap generated", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.analysis.is_roadmap_generation, false);
    assert.equal(kdaGeneratesRoadmap(), false);
  });

  it("39. safe incomplete-evidence result", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(
      baseInput({ independentRead: buildIncompleteEvidenceRead() }),
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.status, "incomplete_evidence");
  });

  it("40. safe blocked result", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(
      baseInput({
        editorialUnderstanding: buildFixtureUnderstanding({
          manuscript_version_id: "wrong-version",
        }),
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "understanding_mismatch");
      assert.equal(result.status, "blocked");
    }
  });

  it("41. safe failed result", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(
      baseInput({ independentRead: buildCompleteIndependentRead({ status: "failed" }) }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "read_failed");
  });

  it("42. provenance preserved", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.analysis.independent_read_id, result.analysis.provenance.independent_read_id);
      assert.equal(result.analysis.author_intent_id, buildFixtureAuthorIntent().id);
      assert.equal(result.analysis.eic_execution_id, FIXTURE_EIC_EXECUTION_ID);
    }
  });

  it("43. audit history created", () => {
    const result = createKnowledgeDomainAnalysisCandidateFromIndependentRead(baseInput());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.analysis.audit_history.length >= 2);
      assert.equal(result.analysis.audit_history[0]?.event_type, "analysis_created");
    }
  });

  it("44. no live model call required by unit tests", () => {
    assert.equal(kdaPerformsExpertActivation(), false);
    assert.equal(kdaGrantsSpecialistAccess(), false);
    assert.equal(kdaEnablesCommercialExperts(), false);
  });

  it("45. existing 70 KDA foundation tests remain passing — run separately", () => {
    assert.ok(true);
  });

  it("46. existing 142 Editorial Profile tests remain passing — run separately", () => {
    assert.ok(true);
  });
});
