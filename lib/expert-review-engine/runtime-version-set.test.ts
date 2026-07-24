import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LITERARY_AGENT } from "@/lib/ai/review-engine.ts";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import {
  LITERARY_AGENT_CONSTITUTION_ADAPTER_OPTIONS,
  LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH,
  computeLiteraryAgentConstitutionDefinitionHash,
} from "./literary-agent-constitution-hash.ts";
import { reviewerDefinitionToExpertDefinition } from "@/lib/expert-registry/adapters/reviewer-definition.ts";
import { hashExpertDefinition } from "@/lib/expert-registry/definition-hash.ts";
import { literaryAgentRegistryDefinitionV1 } from "@/lib/expert-registry/seed/literary-agent-registry.v1.ts";
import {
  REVIEW_RUNTIME_VERSION_FIELDS,
  REVIEW_RUNTIME_VERSION_SET_SCHEMA_VERSION,
  validateReviewRuntimeVersionSet,
} from "./types.ts";
import { LITERARY_AGENT_DEFINITION_VERSION } from "@/lib/editorial-workflow/types.ts";

const EXPECTED_CONSTITUTION_ADAPTER_HASH =
  "8f8b56a9de6c7d68f96fd7913645905ee2afb8ce7d0c066faba2c28106fe94f5";

const EXPECTED_REGISTRY_SEED_HASH =
  "f6b79bc07d7ba9630fb532c67c31c4b80bac2886002696e25290d163e4b44671";

describe("ReviewRuntimeVersionSet contract", () => {
  it("includes schema_version, constitution_definition_hash, and workflow_definition_version", () => {
    const versions = literaryAgentRuntimeDefinition().runtime_versions;
    assert.equal(versions.schema_version, REVIEW_RUNTIME_VERSION_SET_SCHEMA_VERSION);
    assert.equal(versions.constitution_definition_hash, LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH);
    assert.equal(versions.workflow_definition_version, LITERARY_AGENT_DEFINITION_VERSION);
    assert.equal(REVIEW_RUNTIME_VERSION_FIELDS.length, 15);
  });

  it("validates all required version-set fields", () => {
    const result = validateReviewRuntimeVersionSet(literaryAgentRuntimeDefinition().runtime_versions);
    assert.equal(result.ok, true);
  });

  it("rejects missing schema_version", () => {
    const versions = literaryAgentRuntimeDefinition().runtime_versions;
    const result = validateReviewRuntimeVersionSet({
      ...versions,
      schema_version: "" as typeof REVIEW_RUNTIME_VERSION_SET_SCHEMA_VERSION,
    });
    assert.equal(result.ok, false);
  });

  it("rejects malformed constitution_definition_hash", () => {
    const versions = literaryAgentRuntimeDefinition().runtime_versions;
    const result = validateReviewRuntimeVersionSet({
      ...versions,
      constitution_definition_hash: "NOT_A_HASH",
    });
    assert.equal(result.ok, false);
  });

  it("rejects empty workflow_definition_version", () => {
    const versions = literaryAgentRuntimeDefinition().runtime_versions;
    const result = validateReviewRuntimeVersionSet({
      ...versions,
      workflow_definition_version: "",
    });
    assert.equal(result.ok, false);
  });
});

describe("Literary Agent constitution linkage", () => {
  it("runtime version set constitution hash equals canonical adapter source", () => {
    const runtimeVersions = literaryAgentRuntimeDefinition().runtime_versions;
    assert.equal(runtimeVersions.constitution_definition_hash, EXPECTED_CONSTITUTION_ADAPTER_HASH);
    assert.equal(
      computeLiteraryAgentConstitutionDefinitionHash(),
      LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH,
    );
    assert.equal(
      hashExpertDefinition(
        reviewerDefinitionToExpertDefinition(LITERARY_AGENT, LITERARY_AGENT_CONSTITUTION_ADAPTER_OPTIONS),
      ),
      EXPECTED_CONSTITUTION_ADAPTER_HASH,
    );
  });

  it("registry seed hash remains unchanged", () => {
    assert.equal(hashExpertDefinition(literaryAgentRegistryDefinitionV1()), EXPECTED_REGISTRY_SEED_HASH);
  });

  it("changing ReviewerDefinition mission changes constitution hash but not runtime hash alone", () => {
    const source = structuredClone(LITERARY_AGENT);
    source.mission = `${LITERARY_AGENT.mission} (constitution drift test)`;
    const changedConstitutionHash = hashExpertDefinition(
      reviewerDefinitionToExpertDefinition(source, LITERARY_AGENT_CONSTITUTION_ADAPTER_OPTIONS),
    );
    assert.notEqual(changedConstitutionHash, LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH);
  });

  it("runtime version set stores constitution hash as an independent string", () => {
    const runtimeVersions = literaryAgentRuntimeDefinition().runtime_versions;
    const adapterOutput = reviewerDefinitionToExpertDefinition(
      LITERARY_AGENT,
      LITERARY_AGENT_CONSTITUTION_ADAPTER_OPTIONS,
    );
    const hashBeforeMutation = runtimeVersions.constitution_definition_hash;
    adapterOutput.purpose.mission = "mutated mission";
    assert.equal(runtimeVersions.constitution_definition_hash, hashBeforeMutation);
    assert.equal(runtimeVersions.constitution_definition_hash, LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH);
  });
});
