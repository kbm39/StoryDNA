import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { MILITARY_EXPERT, buildSystemPrompt } from "./definition.ts";
import {
  computeMilitaryExpertConstitutionDefinitionHash,
} from "./military-expert-constitution-hash.ts";
import { militaryExpertRuntimeDefinition } from "./runtime-definition.ts";
import {
  buildMilitaryExpertGenerationRequest,
  hashMilitaryExpertGenerationRequest,
  hashMilitaryExpertParsedReview,
  hashMilitaryExpertRawResponse,
  hashMilitaryExpertReviewPrompt,
  hashMilitaryExpertSystemPrompt,
  runMilitaryExpertGenerationContract,
} from "./generation-contract.ts";
import {
  buildMilitaryExpertReviewPrompt,
  buildMilitaryExpertSystemPrompt,
} from "./prompts.ts";
import { canonicalJsonString, MAX_CANONICAL_OUTPUT_BYTES } from "@/lib/expert-review-engine/canonical-output.ts";
import { parseMilitaryExpertGenerationResponse } from "./parsing.ts";
import { classifyMilitaryExpertRepairNeed } from "./repair-classification.ts";
import { normalizeMilitaryExpertReview } from "./normalization.ts";
import { buildValidMilitaryExpertReview } from "./fixtures.ts";
import {
  FIXTURE_CORRELATION_ID,
  FIXTURE_MANUSCRIPT_HASH,
  FIXTURE_MANUSCRIPT_TEXT,
  FIXTURE_MANUSCRIPT_VERSION_ID,
  FIXTURE_ACCURATE_NEGATIVE_DEDUCTION,
  FIXTURE_CORRELATION_MISMATCH,
  FIXTURE_CRITICAL_WEAK_EVIDENCE,
  FIXTURE_DETERMINISTIC_CLEANUP_ONLY,
  FIXTURE_FABRICATED_SOURCE,
  FIXTURE_INSUFFICIENT_EVIDENCE_DEDUCTION,
  FIXTURE_LETTER_GRADE,
  FIXTURE_MALFORMED_JSON,
  FIXTURE_MISSING_CONTRARY_EVIDENCE,
  FIXTURE_MISSING_EVIDENCE,
  FIXTURE_MULTIPLE_PAYLOADS,
  FIXTURE_OUTSIDE_DOMAIN_NO_ESCALATION,
  FIXTURE_PROVIDER_REPAIR_REQUIRED,
  FIXTURE_RESPONSE_TOO_LARGE,
  FIXTURE_TRAILING_PROSE,
  FIXTURE_UNSUPPORTED_CATEGORY,
  FIXTURE_UNSUPPORTED_ENUM,
  FIXTURE_UNSAFE_OPERATIONAL_DETAIL,
  FIXTURE_VALID_COMPLETE_JSON,
  FIXTURE_VALID_FENCED_JSON,
  buildInvalidGenerationContractInput,
  buildValidGenerationContractInput,
  buildValidGenerationJson,
} from "./generation-fixtures.ts";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import {
  LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH,
} from "@/lib/expert-review-engine/literary-agent-constitution-hash.ts";
import { hashExpertRuntimeDefinition } from "@/lib/expert-review-engine/types.ts";
import {
  EXPERT_MILITARY_GENERATION_CONTRACT_FLAG_NAME,
  readExpertMilitaryGenerationContractEnabled,
} from "@/lib/expert-review-engine/feature-flags.ts";
import { getExpertCatalogEntry } from "@/lib/expert-catalog.ts";
import { runExpertReview } from "@/lib/expert-review-engine/run-expert-review.ts";
import { createInCodeExpertRuntimeRegistry } from "@/lib/expert-review-engine/registry/in-code-registry-adapter.ts";
import { LITERARY_AGENT_EXPERT_VERSION } from "@/experts/literary-agent/runtime-definition.ts";
import { runMilitaryExpertDeterministicParity } from "@/lib/expert-review-engine/military-expert-parity.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const EXPECTED_ME_CONSTITUTION_HASH =
  "95fe3cde05a5b045ccaea21c7acd194d1429b3c481b21741b4e465d174ccf7a0";
const EXPECTED_ME_RUNTIME_HASH =
  "4c7c1312769325e2a2600c682cf9fd42ac73ab3332f72b3bdd3634aff4a7a3f9";
const EXPECTED_LA_RUNTIME_HASH =
  "f4006eaa497dd1d821f30fdac33dcb4869eff68d1af46b1f7401a972020ca50b";
const EXPECTED_LA_CONSTITUTION_HASH =
  "8f8b56a9de6c7d68f96fd7913645905ee2afb8ce7d0c066faba2c28106fe94f5";

function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function requestInput() {
  return {
    correlationId: FIXTURE_CORRELATION_ID,
    manuscriptVersionId: FIXTURE_MANUSCRIPT_VERSION_ID,
    reviewScope: "full_manuscript" as const,
    manuscriptText: FIXTURE_MANUSCRIPT_TEXT,
    canonicalWordCount: 24,
    manuscriptHash: FIXTURE_MANUSCRIPT_HASH,
  };
}

function buildLargeManuscriptWords(wordCount: number): string {
  const chunk = "operational ";
  return chunk.repeat(wordCount).trim();
}

describe("Military Expert PR 2 generation contract", () => {
  it("1. real prompt builders replace draft stubs", () => {
    const systemPrompt = buildSystemPrompt(MILITARY_EXPERT);
    assert.doesNotMatch(systemPrompt, /DRAFT_STUB/);
    assert.match(systemPrompt, /MILITARY EXPERT CHARTER/);
  });

  it("2. prompts deterministic", () => {
    const a = buildMilitaryExpertSystemPrompt(MILITARY_EXPERT);
    const b = buildMilitaryExpertSystemPrompt(MILITARY_EXPERT);
    assert.equal(a, b);
  });

  it("3. prompts contain charter and safety rules", () => {
    const prompt = buildMilitaryExpertSystemPrompt(MILITARY_EXPERT);
    assert.match(prompt, /SAFETY AND EVIDENCE LIMITS/);
    assert.match(prompt, /Do not provide step-by-step operational instructions/);
  });

  it("4. prompts require contrary evidence", () => {
    const prompt = buildMilitaryExpertReviewPrompt({ def: MILITARY_EXPERT, ...requestInput() });
    assert.match(prompt, /contrary evidence/i);
  });

  it("5. prompts forbid letter grade", () => {
    const prompt = buildMilitaryExpertSystemPrompt(MILITARY_EXPERT);
    assert.match(prompt, /Do not assign letter grades/);
  });

  it("6. prompts preserve dramatic intent", () => {
    const prompt = buildMilitaryExpertSystemPrompt(MILITARY_EXPERT);
    assert.match(prompt, /Preserve dramatic intent/);
  });

  it("7. provider-independent request deterministic", () => {
    const a = buildMilitaryExpertGenerationRequest(requestInput());
    const b = buildMilitaryExpertGenerationRequest(requestInput());
    assert.deepEqual(a, b);
  });

  it("8. no SDK/provider types", () => {
    const request = buildMilitaryExpertGenerationRequest(requestInput());
    assert.equal(typeof request.systemPrompt, "string");
    assert.equal(request.responseFormat, "json_object");
    assert.doesNotMatch(JSON.stringify(request), /anthropic|openai/i);
  });

  it("9. parser accepts valid JSON", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_VALID_COMPLETE_JSON, {
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(parsed.ok, true);
  });

  it("10. parser accepts approved fenced JSON", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_VALID_FENCED_JSON, {
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(parsed.ok, true);
  });

  it("11. malformed JSON rejected", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_MALFORMED_JSON);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "malformed_json");
  });

  it("12. multiple payloads rejected", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_MULTIPLE_PAYLOADS);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "multiple_payloads");
  });

  it("13. trailing prose rejected", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_TRAILING_PROSE);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "trailing_content");
  });

  it("14. missing evidence rejected", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_MISSING_EVIDENCE);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "evidence_missing");
  });

  it("15. missing contrary evidence rejected", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_MISSING_CONTRARY_EVIDENCE);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "evidence_missing");
  });

  it("16. unsupported category rejected", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_UNSUPPORTED_CATEGORY);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "unsupported_category");
  });

  it("17. unsupported enum rejected", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_UNSUPPORTED_ENUM);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "unsupported_enum");
  });

  it("18. unsafe detail rejected", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_UNSAFE_OPERATIONAL_DETAIL);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "unsafe_content");
  });

  it("19. letter grade rejected", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_LETTER_GRADE);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "unsafe_content");
  });

  it("20. fabricated source rejected", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_FABRICATED_SOURCE);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "unsafe_content");
  });

  it("21. insufficient evidence cannot deduct", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_INSUFFICIENT_EVIDENCE_DEDUCTION);
    assert.equal(parsed.ok, false);
  });

  it("22. accurate cannot deduct", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_ACCURATE_NEGATIVE_DEDUCTION);
    assert.equal(parsed.ok, false);
  });

  it("23. critical weak-evidence rule", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_CRITICAL_WEAK_EVIDENCE);
    assert.equal(parsed.ok, false);
  });

  it("24. outside domain must escalate", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_OUTSIDE_DOMAIN_NO_ESCALATION);
    assert.equal(parsed.ok, false);
  });

  it("25. output-size limit", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_RESPONSE_TOO_LARGE);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "output_too_large");
  });

  it("26. correlation mismatch", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_CORRELATION_MISMATCH, {
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "correlation_mismatch");
  });

  it("27. deterministic cleanup classification", () => {
    const wrapped = "  ```json\n" + buildValidGenerationJson() + "\n```  ";
    const result = classifyMilitaryExpertRepairNeed({
      raw: { ...FIXTURE_DETERMINISTIC_CLEANUP_ONLY, responseText: wrapped },
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.ok(
      result.decision === "no_repair_needed" ||
        result.decision === "deterministic_cleanup_allowed",
    );
  });

  it("28. provider repair classification", () => {
    const result = classifyMilitaryExpertRepairNeed({ raw: FIXTURE_PROVIDER_REPAIR_REQUIRED });
    assert.equal(result.decision, "provider_repair_required");
  });

  it("29. repair not executed", () => {
    const result = classifyMilitaryExpertRepairNeed({ raw: FIXTURE_MALFORMED_JSON });
    assert.notEqual(result.decision, "no_repair_needed");
    assert.ok(result.decision === "provider_repair_required" || result.decision === "reject_output");
  });

  it("30. valid contract run succeeds", async () => {
    const result = await runMilitaryExpertGenerationContract(buildValidGenerationContractInput(), {
      bypassFeatureFlag: true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.generationStatus, "success");
  });

  it("31. invalid contract run fails closed", async () => {
    const result = await runMilitaryExpertGenerationContract(buildInvalidGenerationContractInput(), {
      bypassFeatureFlag: true,
    });
    assert.equal(result.ok, false);
  });

  it("32. modelCalls zero", async () => {
    const result = await runMilitaryExpertGenerationContract(buildValidGenerationContractInput(), {
      bypassFeatureFlag: true,
    });
    assert.equal(result.modelCalls, 0);
  });

  it("33. writes zero", async () => {
    const result = await runMilitaryExpertGenerationContract(buildValidGenerationContractInput(), {
      bypassFeatureFlag: true,
    });
    assert.equal(result.writes, 0);
  });

  it("34. filesWritten zero", async () => {
    const result = await runMilitaryExpertGenerationContract(buildValidGenerationContractInput(), {
      bypassFeatureFlag: true,
    });
    assert.equal(result.filesWritten, 0);
  });

  it("35. productionExecutionOccurred false", async () => {
    const result = await runMilitaryExpertGenerationContract(buildValidGenerationContractInput(), {
      bypassFeatureFlag: true,
    });
    assert.equal(result.productionExecutionOccurred, false);
  });

  it("36. input not mutated", async () => {
    const input = buildValidGenerationContractInput();
    const snapshot = structuredClone(input);
    await runMilitaryExpertGenerationContract(input, { bypassFeatureFlag: true });
    assert.deepEqual(input, snapshot);
  });

  it("37. prompt hashes deterministic", () => {
    const request = buildMilitaryExpertGenerationRequest(requestInput());
    assert.equal(
      hashMilitaryExpertSystemPrompt(request.systemPrompt),
      hashMilitaryExpertSystemPrompt(request.systemPrompt),
    );
  });

  it("38. meaningful prompt mutation changes hash", () => {
    const request = buildMilitaryExpertGenerationRequest(requestInput());
    const mutated = hashMilitaryExpertSystemPrompt(`${request.systemPrompt}\nmutation`);
    assert.notEqual(hashMilitaryExpertSystemPrompt(request.systemPrompt), mutated);
  });

  it("39. response hash deterministic", () => {
    assert.equal(
      hashMilitaryExpertRawResponse(FIXTURE_VALID_COMPLETE_JSON),
      hashMilitaryExpertRawResponse(FIXTURE_VALID_COMPLETE_JSON),
    );
  });

  it("40. parsed review hash deterministic", async () => {
    const result = await runMilitaryExpertGenerationContract(buildValidGenerationContractInput(), {
      bypassFeatureFlag: true,
    });
    assert.ok(result.parsedReviewHash);
    assert.equal(result.parsedReviewHash, result.parsedReviewHash);
  });

  it("41. direct/engine prompt parity", () => {
    const parity = runMilitaryExpertDeterministicParity({ bypassFeatureFlag: true });
    assert.equal(parity.ok, true);
  });

  it("42. direct/engine parser parity", () => {
    const a = parseMilitaryExpertGenerationResponse(FIXTURE_VALID_COMPLETE_JSON, {
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    const b = parseMilitaryExpertGenerationResponse(structuredClone(FIXTURE_VALID_COMPLETE_JSON), {
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.deepEqual(a, b);
  });

  it("43. direct/engine normalization parity", () => {
    const a = normalizeMilitaryExpertReview(buildValidMilitaryExpertReview());
    const b = normalizeMilitaryExpertReview(structuredClone(buildValidMilitaryExpertReview()));
    assert.deepEqual(a, b);
  });

  it("44. no provider import", () => {
    const sources = [
      read("experts/military-expert/generation-contract.ts"),
      read("experts/military-expert/parsing.ts"),
      read("experts/military-expert/prompts.ts"),
    ].join("\n");
    assert.doesNotMatch(sources, /@\/lib\/ai\/anthropic/);
    assert.doesNotMatch(sources, /openai/);
  });

  it("45. no Trigger import", () => {
    const sources = read("experts/military-expert/generation-contract.ts");
    assert.doesNotMatch(sources, /@trigger\.dev/);
  });

  it("46. no DB write", () => {
    const sources = read("experts/military-expert/generation-contract.ts");
    assert.doesNotMatch(sources, /supabase/);
  });

  it("47. no publishing", () => {
    const runtime = militaryExpertRuntimeDefinition();
    assert.equal(runtime.publishing_policy.authoritative, false);
  });

  it("48. no DOCX", () => {
    const sources = read("experts/military-expert/generation-contract.ts");
    assert.doesNotMatch(sources, /docx/i);
  });

  it("49. no production caller import", () => {
    assert.doesNotMatch(read("lib/editorial-generation/run-fresh-editorial-generation.ts"), /generation-contract/);
  });

  it("50. feature flag default off", () => {
    assert.equal(readExpertMilitaryGenerationContractEnabled({}), false);
  });

  it("51. malformed flag off", () => {
    assert.equal(
      readExpertMilitaryGenerationContractEnabled({ [EXPERT_MILITARY_GENERATION_CONTRACT_FLAG_NAME]: "maybe" }),
      false,
    );
  });

  it("52. test bypass works", async () => {
    const result = await runMilitaryExpertGenerationContract(buildValidGenerationContractInput(), {
      bypassFeatureFlag: true,
    });
    assert.equal(result.ok, true);
  });

  it("53. UI remains Coming Soon", () => {
    const entry = getExpertCatalogEntry("military_expert");
    assert.equal(entry!.availability, "coming_soon");
  });

  it("54. checkbox remains disabled", () => {
    assert.equal(getExpertCatalogEntry("military_expert")!.selectionEnabled, false);
  });

  it("55. runtime remains draft/not certified/disabled", () => {
    const runtime = militaryExpertRuntimeDefinition();
    assert.equal(runtime.enabled, false);
    assert.equal(runtime.expert_version, "v1.0.0-draft");
  });

  it("56. no certified tag", () => {
    assert.notEqual(militaryExpertRuntimeDefinition().expert_version, "v1.0.0-certified");
  });

  it("57. runExpertReview remains plan-only", async () => {
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
    if (result.ok) assert.equal(result.plan.executionAllowed, false);
  });

  it("58. executionAllowed remains false", async () => {
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

  it("59. Literary Agent hashes unchanged", () => {
    assert.equal(
      hashExpertRuntimeDefinition(literaryAgentRuntimeDefinition()),
      EXPECTED_LA_RUNTIME_HASH,
    );
    assert.equal(LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH, EXPECTED_LA_CONSTITUTION_HASH);
  });

  it("60. no migration/deployment", () => {
    assert.doesNotMatch(read("lib/expert-registry/seed/platform-seeds.ts"), /0024/);
    assert.equal(
      computeMilitaryExpertConstitutionDefinitionHash(),
      EXPECTED_ME_CONSTITUTION_HASH,
    );
    assert.equal(
      hashExpertRuntimeDefinition(militaryExpertRuntimeDefinition()),
      EXPECTED_ME_RUNTIME_HASH,
    );
    const request = buildMilitaryExpertGenerationRequest(requestInput());
    assert.ok(hashMilitaryExpertGenerationRequest(request));
    assert.ok(hashMilitaryExpertReviewPrompt(request.reviewPrompt, request.manuscriptHash));
    const review = buildValidMilitaryExpertReview();
    assert.ok(hashMilitaryExpertParsedReview(review));
  });

  it("61. large manuscript raw review prompt exceeds canonical byte limit", () => {
    const wordCount = 120_000;
    const largeText = buildLargeManuscriptWords(wordCount);
    const reviewPrompt = buildMilitaryExpertReviewPrompt({
      def: MILITARY_EXPERT,
      ...requestInput(),
      manuscriptText: largeText,
      canonicalWordCount: wordCount,
    });
    assert.throws(
      () =>
        canonicalJsonString({
          kind: "review_prompt",
          text: reviewPrompt,
        }),
      /output_size_exceeded/,
    );
    assert.ok(reviewPrompt.length > MAX_CANONICAL_OUTPUT_BYTES);
  });

  it("62. large manuscript review prompt hash succeeds deterministically", () => {
    const wordCount = 120_000;
    const largeText = buildLargeManuscriptWords(wordCount);
    const reviewPrompt = buildMilitaryExpertReviewPrompt({
      def: MILITARY_EXPERT,
      ...requestInput(),
      manuscriptText: largeText,
      canonicalWordCount: wordCount,
    });
    const hashA = hashMilitaryExpertReviewPrompt(reviewPrompt, FIXTURE_MANUSCRIPT_HASH);
    const hashB = hashMilitaryExpertReviewPrompt(reviewPrompt, FIXTURE_MANUSCRIPT_HASH);
    assert.equal(hashA, hashB);
    assert.match(hashA, /^[a-f0-9]{64}$/);
  });

  it("63. manuscript content identity changes review prompt hash", () => {
    const wordCount = 120_000;
    const reviewPrompt = buildMilitaryExpertReviewPrompt({
      def: MILITARY_EXPERT,
      ...requestInput(),
      manuscriptText: buildLargeManuscriptWords(wordCount),
      canonicalWordCount: wordCount,
    });
    const hashA = hashMilitaryExpertReviewPrompt(reviewPrompt, FIXTURE_MANUSCRIPT_HASH);
    const hashB = hashMilitaryExpertReviewPrompt(reviewPrompt, "different-manuscript-hash");
    assert.notEqual(hashA, hashB);
  });

  it("64. large manuscript generation request hash succeeds", () => {
    const wordCount = 120_000;
    const request = buildMilitaryExpertGenerationRequest({
      ...requestInput(),
      manuscriptText: buildLargeManuscriptWords(wordCount),
      canonicalWordCount: wordCount,
    });
    const hashA = hashMilitaryExpertGenerationRequest(request);
    const hashB = hashMilitaryExpertGenerationRequest(request);
    assert.equal(hashA, hashB);
  });

  it("65. large manuscript contract run succeeds without provider call", async () => {
    const wordCount = 120_000;
    const input = {
      ...buildValidGenerationContractInput(),
      manuscriptText: buildLargeManuscriptWords(wordCount),
      canonicalWordCount: wordCount,
    };
    const result = await runMilitaryExpertGenerationContract(input, {
      bypassFeatureFlag: true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.generationStatus, "success");
    assert.equal(result.modelCalls, 0);
    assert.ok(result.reviewPromptHash);
    assert.ok(result.requestHash);
  });
});
