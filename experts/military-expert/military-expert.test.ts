import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { MILITARY_EXPERT, buildSystemPrompt } from "./definition.ts";
import {
  MILITARY_EXPERT_CATEGORIES,
  MILITARY_EXPERT_KEY,
  MILITARY_EXPERT_VERSION,
  type MilitaryExpertFinding,
  type MilitaryExpertReview,
} from "./contracts.ts";
import {
  computeMilitaryExpertConstitutionDefinitionHash,
  MILITARY_EXPERT_CONSTITUTION_DEFINITION_HASH,
} from "./military-expert-constitution-hash.ts";
import { militaryExpertRuntimeDefinition } from "./runtime-definition.ts";
import { militaryExpertRegistryDefinitionV1 } from "@/lib/expert-registry/seed/military-expert-registry.v1.ts";
import { validateExpertDefinition } from "@/lib/expert-registry/schema.ts";
import { hashExpertDefinition } from "@/lib/expert-registry/definition-hash.ts";
import { hashExpertRuntimeDefinition } from "@/lib/expert-review-engine/types.ts";
import { deepFreeze } from "@/lib/expert-review-engine/deep-freeze.ts";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import {
  LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH,
} from "@/lib/expert-review-engine/literary-agent-constitution-hash.ts";
import { literaryAgentRegistryDefinitionV1 } from "@/lib/expert-registry/seed/literary-agent-registry.v1.ts";
import { loadMilitaryExpertDraftRuntimeDefinition } from "@/lib/expert-review-engine/registry/draft-experts.ts";
import {
  bootstrapExpertRuntimeRegistry,
  clearExpertRuntimeRegistryForTests,
  getExpertRuntimeDefinition,
} from "@/lib/expert-review-engine/registry/in-code.ts";
import { runExpertReview } from "@/lib/expert-review-engine/run-expert-review.ts";
import { createInCodeExpertRuntimeRegistry } from "@/lib/expert-review-engine/registry/in-code-registry-adapter.ts";
import { LITERARY_AGENT_EXPERT_VERSION } from "@/experts/literary-agent/runtime-definition.ts";
import {
  getExpertCatalogEntry,
} from "@/lib/expert-catalog.ts";
import {
  buildInvalidMilitaryExpertReview,
  buildValidMilitaryExpertReview,
  FIXTURE_CONTRARY_EVIDENCE_NARROWS,
  FIXTURE_INCORRECT_RANK_AUTHORITY,
  FIXTURE_MISSING_EVIDENCE,
  FIXTURE_UNSUPPORTED_CONFIDENCE,
} from "./fixtures.ts";
import { normalizeMilitaryExpertReview } from "./normalization.ts";
import { validateMilitaryExpertReview } from "./validation.ts";
import { runMilitaryExpertDraftCertification } from "./certification.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const EXPECTED_LA_RUNTIME_HASH =
  "f4006eaa497dd1d821f30fdac33dcb4869eff68d1af46b1f7401a972020ca50b";
const EXPECTED_LA_CONSTITUTION_HASH =
  "8f8b56a9de6c7d68f96fd7913645905ee2afb8ce7d0c066faba2c28106fe94f5";
const EXPECTED_LA_REGISTRY_SEED_HASH =
  "f6b79bc07d7ba9630fb532c67c31c4b80bac2886002696e25290d163e4b44671";

function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function withFinding(
  review: MilitaryExpertReview,
  finding: MilitaryExpertFinding,
): MilitaryExpertReview {
  return { ...review, findings: [finding] };
}

describe("Military Expert PR 1", () => {
  it("1. Military Expert key/version", () => {
    assert.equal(MILITARY_EXPERT.id, MILITARY_EXPERT_KEY);
    assert.equal(militaryExpertRuntimeDefinition().expert_version, MILITARY_EXPERT_VERSION);
  });

  it("2. draft status", () => {
    const registry = militaryExpertRegistryDefinitionV1();
    assert.equal(registry.versioning.lifecycle_status, "draft");
    assert.equal(registry.versioning.version, "v1.0.0-draft");
  });

  it("3. not certified", () => {
    const runtime = militaryExpertRuntimeDefinition();
    assert.equal(runtime.enabled, false);
    assert.notEqual(runtime.expert_version, "v1.0.0-certified");
  });

  it("4. not production available", () => {
    clearExpertRuntimeRegistryForTests();
    bootstrapExpertRuntimeRegistry();
    assert.equal(getExpertRuntimeDefinition("military_expert"), null);
    assert.equal(getExpertRuntimeDefinition("military_expert", { includeDisabled: true }), null);
  });

  it("5. registry loads definition", () => {
    const result = validateExpertDefinition(militaryExpertRegistryDefinitionV1());
    assert.equal(result.ok, true);
    assert.ok(loadMilitaryExpertDraftRuntimeDefinition());
  });

  it("6. definition deeply immutable", () => {
    const clone = structuredClone(MILITARY_EXPERT);
    deepFreeze(clone);
    assert.throws(() => {
      (clone as { mission: string }).mission = "changed";
    }, TypeError);
  });

  it("7. runtime deeply immutable", () => {
    const runtime = structuredClone(militaryExpertRuntimeDefinition());
    deepFreeze(runtime);
    assert.throws(() => {
      (runtime as { enabled: boolean }).enabled = true;
    }, TypeError);
  });

  it("8. knowledge domains complete", () => {
    assert.equal(MILITARY_EXPERT.knowledgeDomains.length, 10);
    assert.ok(MILITARY_EXPERT.knowledgeDomains.some((domain) => domain.name === "Logistics"));
  });

  it("9. triggers complete", () => {
    assert.ok(MILITARY_EXPERT.triggers.length >= 10);
    assert.ok(MILITARY_EXPERT.triggers.some((trigger) => trigger.key === "combat"));
  });

  it("10. prerequisites complete", () => {
    assert.ok(MILITARY_EXPERT.prerequisites.length >= 4);
    assert.ok(MILITARY_EXPERT.prerequisites.some((item) => item.key === "readable_manuscript"));
  });

  it("11. failure conditions complete", () => {
    assert.ok(MILITARY_EXPERT.failureConditions.length >= 5);
    assert.ok(
      MILITARY_EXPERT.failureConditions.some((item) => item.key === "unsafe_operational_detail"),
    );
  });

  it("12. responsibility boundaries explicit", () => {
    assert.ok(MILITARY_EXPERT.expertise.inScope.length >= 5);
    assert.ok(MILITARY_EXPERT.expertise.outOfScope.some((item) => /commercial/i.test(item)));
  });

  it("13. escalation relationships use authoritative location", () => {
    const runtime = militaryExpertRuntimeDefinition();
    assert.ok(runtime.editor_in_chief_rules.escalationExperts.includes("librarian"));
    assert.deepEqual(runtime.editor_in_chief_rules.escalationExperts, ["librarian", "psychologist"]);
    assert.deepEqual(runtime.editor_in_chief_rules.compatibleExperts, [
      "developmental_editor",
      "line_editor",
      "literary_agent",
    ]);
  });

  it("14. review categories exact", () => {
    assert.deepEqual([...MILITARY_EXPERT_CATEGORIES], [
      "command_and_organization",
      "operations_and_tactics",
      "weapons_and_equipment",
      "intelligence_and_opsec",
      "logistics_and_timing",
      "human_performance",
      "communications_and_terminology",
      "military_culture",
      "rules_authority_and_coordination",
      "overall_operational_realism",
    ]);
  });

  it("15. finding contract validates", () => {
    const review = buildValidMilitaryExpertReview();
    review.definition_hash = militaryExpertRuntimeDefinition().runtime_versions.definition_hash;
    const result = validateMilitaryExpertReview(normalizeMilitaryExpertReview(review), {
      expectedDefinitionHash: review.definition_hash,
    });
    assert.equal(result.ok, true);
  });

  it("16. unsupported category rejected", () => {
    const review = withFinding(buildValidMilitaryExpertReview(), {
      ...FIXTURE_INCORRECT_RANK_AUTHORITY,
      category: "not_a_category" as MilitaryExpertFinding["category"],
    });
    const result = validateMilitaryExpertReview(review);
    assert.equal(result.ok, false);
  });

  it("17. unsupported enum rejected", () => {
    const review = withFinding(buildValidMilitaryExpertReview(), {
      ...FIXTURE_INCORRECT_RANK_AUTHORITY,
      realism_status: "made_up" as MilitaryExpertFinding["realism_status"],
    });
    const result = validateMilitaryExpertReview(review);
    assert.equal(result.ok, false);
  });

  it("18. negative finding without evidence rejected", () => {
    const result = validateMilitaryExpertReview(
      withFinding(buildValidMilitaryExpertReview(), FIXTURE_MISSING_EVIDENCE),
    );
    assert.equal(result.ok, false);
  });

  it("19. negative finding without confidence rejected", () => {
    const finding = {
      ...FIXTURE_INCORRECT_RANK_AUTHORITY,
      confidence: "" as MilitaryExpertFinding["confidence"],
    };
    const result = validateMilitaryExpertReview(withFinding(buildValidMilitaryExpertReview(), finding));
    assert.equal(result.ok, false);
  });

  it("20. negative finding without operational impact rejected", () => {
    const finding = { ...FIXTURE_INCORRECT_RANK_AUTHORITY, operational_impact: "   " };
    const result = validateMilitaryExpertReview(withFinding(buildValidMilitaryExpertReview(), finding));
    assert.equal(result.ok, false);
  });

  it("21. negative finding without recommendation rejected", () => {
    const finding = { ...FIXTURE_INCORRECT_RANK_AUTHORITY, recommendation: "" };
    const result = validateMilitaryExpertReview(withFinding(buildValidMilitaryExpertReview(), finding));
    assert.equal(result.ok, false);
  });

  it("22. negative finding without preservation note rejected", () => {
    const finding = { ...FIXTURE_INCORRECT_RANK_AUTHORITY, preservation_note: "" };
    const result = validateMilitaryExpertReview(withFinding(buildValidMilitaryExpertReview(), finding));
    assert.equal(result.ok, false);
  });

  it("23. insufficient evidence cannot deduct", () => {
    const finding = {
      ...FIXTURE_INCORRECT_RANK_AUTHORITY,
      realism_status: "insufficient_evidence" as const,
      score_impact: -5,
      manuscript_evidence: [],
      operational_impact: "Not assessed.",
    };
    const result = validateMilitaryExpertReview(withFinding(buildValidMilitaryExpertReview(), finding));
    assert.equal(result.ok, false);
  });

  it("24. accurate finding cannot deduct", () => {
    const finding = {
      ...FIXTURE_INCORRECT_RANK_AUTHORITY,
      realism_status: "accurate" as const,
      score_impact: -3,
      severity: "informational" as const,
    };
    const result = validateMilitaryExpertReview(withFinding(buildValidMilitaryExpertReview(), finding));
    assert.equal(result.ok, false);
  });

  it("25. critical finding evidence rule enforced", () => {
    const result = validateMilitaryExpertReview(
      withFinding(buildValidMilitaryExpertReview(), FIXTURE_UNSUPPORTED_CONFIDENCE),
    );
    assert.equal(result.ok, false);
  });

  it("26. full manuscript copying rejected", () => {
    const hugeExcerpt = Array.from({ length: 600 }, (_, index) => `word${index}`).join(" ");
    const finding = {
      ...FIXTURE_INCORRECT_RANK_AUTHORITY,
      manuscript_evidence: [{ excerpt: hugeExcerpt, locator: "All" }],
    };
    const result = validateMilitaryExpertReview(withFinding(buildValidMilitaryExpertReview(), finding));
    assert.equal(result.ok, false);
  });

  it("27. evidence excerpt length bounded", () => {
    const longExcerpt = Array.from({ length: 100 }, (_, index) => `word${index}`).join(" ");
    const normalized = normalizeMilitaryExpertReview(
      withFinding(buildValidMilitaryExpertReview(), {
        ...FIXTURE_INCORRECT_RANK_AUTHORITY,
        manuscript_evidence: [{ excerpt: longExcerpt, locator: "Chapter 1" }],
      }),
    );
    const words = normalized.findings[0]!.manuscript_evidence[0]!.excerpt.split(/\s+/).length;
    assert.ok(words <= 80);
  });

  it("28. outside-domain finding rejected or escalated", () => {
    const bad = {
      ...FIXTURE_INCORRECT_RANK_AUTHORITY,
      realism_status: "outside_expertise" as const,
      escalation_expert: undefined,
    };
    const result = validateMilitaryExpertReview(withFinding(buildValidMilitaryExpertReview(), bad));
    assert.equal(result.ok, false);
  });

  it("29. fabricated source rejected", () => {
    const finding = {
      ...FIXTURE_INCORRECT_RANK_AUTHORITY,
      source_requirements: "See classified field manual FM-9999 for proof.",
    };
    const result = validateMilitaryExpertReview(withFinding(buildValidMilitaryExpertReview(), finding));
    assert.equal(result.ok, false);
  });

  it("30. letter grade absent", () => {
    const review = buildValidMilitaryExpertReview();
    review.summary = "Overall grade A- with some concerns and strengths.";
    const result = validateMilitaryExpertReview(review);
    assert.equal(result.ok, false);
  });

  it("31. author challenge supported", () => {
    const review = buildValidMilitaryExpertReview();
    review.author_challenge_supported = false as true;
    const result = validateMilitaryExpertReview(review);
    assert.equal(result.ok, false);
  });

  it("32. strengths and concerns both required", () => {
    const review = buildValidMilitaryExpertReview();
    review.summary = "Everything is fine.";
    review.strengths = ["Good action"];
    const result = validateMilitaryExpertReview(review);
    assert.equal(result.ok, false);
  });

  it("33. safety-sensitive detail generalized", () => {
    const finding = {
      ...FIXTURE_INCORRECT_RANK_AUTHORITY,
      recommendation: "Step 1 enter the compound. Step 2 breach the door. Step 3 engage.",
    };
    const result = validateMilitaryExpertReview(withFinding(buildValidMilitaryExpertReview(), finding));
    assert.equal(result.ok, false);
  });

  it("34. stable finding identity deterministic", () => {
    const review = buildValidMilitaryExpertReview();
    const once = normalizeMilitaryExpertReview(review);
    const twice = normalizeMilitaryExpertReview(review);
    assert.equal(once.findings[0]!.finding_id, twice.findings[0]!.finding_id);
  });

  it("35. stable identity changes with meaningful fields", () => {
    const base = normalizeMilitaryExpertReview(buildValidMilitaryExpertReview());
    const changed = normalizeMilitaryExpertReview({
      ...buildValidMilitaryExpertReview(),
      findings: [
        {
          ...buildValidMilitaryExpertReview().findings[0]!,
          title: "Different title",
        },
      ],
    });
    assert.notEqual(base.findings[0]!.finding_id, changed.findings[0]!.finding_id);
  });

  it("36. normalization deterministic", () => {
    const review = buildValidMilitaryExpertReview();
    const once = normalizeMilitaryExpertReview(review);
    const twice = normalizeMilitaryExpertReview(normalizeMilitaryExpertReview(review));
    assert.deepEqual(once, twice);
  });

  it("37. normalization does not invent content", () => {
    const review = buildValidMilitaryExpertReview();
    review.findings = [];
    const normalized = normalizeMilitaryExpertReview(review);
    assert.equal(normalized.findings.length, 0);
    assert.equal(normalized.strengths.length, review.strengths.length);
  });

  it("38. contrary evidence preserved", () => {
    const review = withFinding(buildValidMilitaryExpertReview(), FIXTURE_CONTRARY_EVIDENCE_NARROWS);
    const normalized = normalizeMilitaryExpertReview(review);
    assert.equal(normalized.findings[0]!.contrary_evidence?.length, 1);
  });

  it("39. valid review passes", () => {
    const review = normalizeMilitaryExpertReview(buildValidMilitaryExpertReview());
    review.definition_hash = militaryExpertRuntimeDefinition().runtime_versions.definition_hash;
    assert.equal(
      validateMilitaryExpertReview(review, { expectedDefinitionHash: review.definition_hash }).ok,
      true,
    );
  });

  it("40. invalid review fails closed", () => {
    assert.equal(validateMilitaryExpertReview(buildInvalidMilitaryExpertReview()).ok, false);
  });

  it("41. certification harness reports draft_not_certified", async () => {
    const report = await runMilitaryExpertDraftCertification();
    assert.equal(report.certification_status, "draft_not_certified");
    assert.equal(report.errors.length, 0);
  });

  it("42. definition hash deterministic", () => {
    const h1 = computeMilitaryExpertConstitutionDefinitionHash();
    const h2 = computeMilitaryExpertConstitutionDefinitionHash();
    assert.equal(h1, h2);
    assert.equal(h1, MILITARY_EXPERT_CONSTITUTION_DEFINITION_HASH);
  });

  it("43. runtime hash deterministic", () => {
    const h1 = hashExpertRuntimeDefinition(militaryExpertRuntimeDefinition());
    const h2 = hashExpertRuntimeDefinition(militaryExpertRuntimeDefinition());
    assert.equal(h1, h2);
  });

  it("44. authoritative mutation changes hash", () => {
    const source = structuredClone(MILITARY_EXPERT);
    source.mission = `${MILITARY_EXPERT.mission} (mutation test)`;
    const changed = hashExpertDefinition(
      militaryExpertRegistryDefinitionV1(),
    );
    assert.notEqual(changed, hashExpertDefinition({
      ...militaryExpertRegistryDefinitionV1(),
      purpose: {
        ...militaryExpertRegistryDefinitionV1().purpose,
        mission: `${militaryExpertRegistryDefinitionV1().purpose.mission} (mutation test)`,
      },
    }));
    assert.notEqual(source.mission, MILITARY_EXPERT.mission);
  });

  it("45. Literary Agent runtime hash unchanged", () => {
    assert.equal(
      hashExpertRuntimeDefinition(literaryAgentRuntimeDefinition()),
      EXPECTED_LA_RUNTIME_HASH,
    );
  });

  it("46. constitution adapter hash unchanged", () => {
    assert.equal(LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH, EXPECTED_LA_CONSTITUTION_HASH);
  });

  it("47. registry seed hash behavior understood and intentional", () => {
    assert.equal(
      hashExpertDefinition(literaryAgentRegistryDefinitionV1()),
      EXPECTED_LA_REGISTRY_SEED_HASH,
    );
    assert.notEqual(
      hashExpertDefinition(militaryExpertRegistryDefinitionV1()),
      EXPECTED_LA_REGISTRY_SEED_HASH,
    );
  });

  it("48. no provider import", () => {
    const sources = [
      read("experts/military-expert/definition.ts"),
      read("experts/military-expert/runtime-definition.ts"),
      read("experts/military-expert/certification.ts"),
    ].join("\n");
    assert.doesNotMatch(sources, /@\/lib\/ai\/anthropic/);
    assert.doesNotMatch(sources, /openai/);
  });

  it("49. no Trigger import", () => {
    const sources = [
      read("experts/military-expert/runtime-definition.ts"),
      read("experts/military-expert/certification.ts"),
    ].join("\n");
    assert.doesNotMatch(sources, /@trigger\.dev/);
    assert.doesNotMatch(sources, /trigger\/dev/);
  });

  it("50. no DB write", () => {
    const sources = read("experts/military-expert/certification.ts");
    assert.doesNotMatch(sources, /\.from\(/);
    assert.doesNotMatch(sources, /supabase/);
  });

  it("51. no file write", () => {
    const sources = [
      read("experts/military-expert/certification.ts"),
      read("experts/military-expert/normalization.ts"),
      read("experts/military-expert/validation.ts"),
    ].join("\n");
    assert.doesNotMatch(sources, /writeFileSync/);
    assert.doesNotMatch(sources, /fs\.write/);
  });

  it("52. no publishing", () => {
    const runtime = militaryExpertRuntimeDefinition();
    assert.equal(runtime.publishing_policy.authoritative, false);
    assert.match(runtime.publishing_policy.rpcName, /draft/);
  });

  it("53. no production caller import", () => {
    assert.doesNotMatch(read("lib/expert-review-engine/registry/in-code.ts"), /military-expert/);
    assert.doesNotMatch(read("lib/editorial-generation/run-fresh-editorial-generation.ts"), /military-expert/);
  });

  it("54. UI catalog still marks Military Expert Coming Soon", () => {
    const entry = getExpertCatalogEntry("military_expert");
    assert.ok(entry);
    assert.equal(entry!.availability, "coming_soon");
    assert.equal(entry!.statusLabel, "Coming Soon");
  });

  it("55. Military Expert checkbox remains disabled", () => {
    const entry = getExpertCatalogEntry("military_expert");
    assert.equal(entry!.selectionEnabled, false);
  });

  it("56. runExpertReview remains plan-only", async () => {
    const result = await runExpertReview(
      {
        manuscriptId: "ms-1",
        manuscriptVersionId: "mv-1",
        executionMode: "plan_only",
        expertKey: "literary_agent",
        expertVersion: LITERARY_AGENT_EXPERT_VERSION,
      },
      { registry: createInCodeExpertRuntimeRegistry(), bypassFeatureFlag: true },
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.plan.executionAllowed, false);
    }
  });

  it("57. executionAllowed remains false", async () => {
    const result = await runExpertReview(
      {
        manuscriptId: "ms-1",
        manuscriptVersionId: "mv-1",
        executionMode: "execute",
        expertKey: "literary_agent",
        expertVersion: LITERARY_AGENT_EXPERT_VERSION,
      },
      { registry: createInCodeExpertRuntimeRegistry(), bypassFeatureFlag: true },
    );
    assert.equal(result.ok, false);
  });

  it("58. no migration", () => {
    assert.doesNotMatch(read("lib/expert-registry/seed/platform-seeds.ts"), /0024/);
  });

  it("59. generation contract flag default off", () => {
    const runtime = militaryExpertRuntimeDefinition();
    assert.equal(runtime.enabled, false);
    assert.match(read("lib/expert-review-engine/feature-flags.ts"), /EXPERT_MILITARY_GENERATION_CONTRACT_ENABLED/);
  });

  it("60. no certified tag created", () => {
    assert.notEqual(militaryExpertRuntimeDefinition().expert_version, "v1.0.0-certified");
    const systemPrompt = buildSystemPrompt(MILITARY_EXPERT);
    assert.doesNotMatch(systemPrompt, /DRAFT_STUB/);
    assert.match(systemPrompt, /MILITARY EXPERT CHARTER/);
  });
});
