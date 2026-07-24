import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import {
  hashExpertRuntimeDefinition,
  REVIEW_RUNTIME_VERSION_SET_SCHEMA_VERSION,
} from "./types.ts";
import { validateExpertRuntimeDefinition } from "./validate-runtime-definition.ts";
import { withRuntimeDefinitionHash } from "./rehash-runtime-definition.ts";
import {
  clearExpertRuntimeRegistryForTests,
  registerExpertRuntimeDefinition,
  ExpertRegistryError,
} from "./registry/in-code.ts";

const PREVIOUS_RUNTIME_DEFINITION_HASH =
  "d24ed5215515233b4e2819c0ea527dd8d843b7f2e949587380ca63c38c4c2588";

const EXPECTED_RUNTIME_DEFINITION_HASH =
  "f4006eaa497dd1d821f30fdac33dcb4869eff68d1af46b1f7401a972020ca50b";

describe("runtime definition hash tampering guards", () => {
  it("valid Literary Agent definition with correct definition_hash passes", () => {
    const def = literaryAgentRuntimeDefinition();
    const result = validateExpertRuntimeDefinition(def);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.definitionHash, EXPECTED_RUNTIME_DEFINITION_HASH);
    }
  });

  it("wrong definition_hash fails validation", () => {
    const def = literaryAgentRuntimeDefinition();
    const tampered = {
      ...def,
      runtime_versions: {
        ...def.runtime_versions,
        definition_hash: "0".repeat(64),
      },
    };
    const result = validateExpertRuntimeDefinition(tampered);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("definition_hash")));
    }
  });

  it("one-character mutation in definition_hash fails", () => {
    const def = literaryAgentRuntimeDefinition();
    const validHash = def.runtime_versions.definition_hash;
    const mutated = `${validHash.slice(0, 63)}${validHash.endsWith("a") ? "b" : "a"}`;
    const tampered = {
      ...def,
      runtime_versions: { ...def.runtime_versions, definition_hash: mutated },
    };
    const result = validateExpertRuntimeDefinition(tampered);
    assert.equal(result.ok, false);
  });

  it("changing an authoritative hashed field without recomputing hash fails", () => {
    const def = literaryAgentRuntimeDefinition();
    const tampered = {
      ...def,
      display_name: `${def.display_name} (mutated)`,
    };
    const result = validateExpertRuntimeDefinition(tampered);
    assert.equal(result.ok, false);
  });

  it("changing runtime_versions.schema_version without recomputing hash fails", () => {
    const def = literaryAgentRuntimeDefinition();
    const tampered = {
      ...def,
      runtime_versions: {
        ...def.runtime_versions,
        schema_version: "review_runtime_version_set@v999" as typeof REVIEW_RUNTIME_VERSION_SET_SCHEMA_VERSION,
      },
    };
    const result = validateExpertRuntimeDefinition(tampered);
    assert.equal(result.ok, false);
  });

  it("changing constitution_definition_hash without recomputing hash fails", () => {
    const def = literaryAgentRuntimeDefinition();
    const tampered = {
      ...def,
      runtime_versions: {
        ...def.runtime_versions,
        constitution_definition_hash: "0".repeat(64),
      },
    };
    const result = validateExpertRuntimeDefinition(tampered);
    assert.equal(result.ok, false);
  });

  it("changing workflow_definition_version without recomputing hash fails", () => {
    const def = literaryAgentRuntimeDefinition();
    const tampered = {
      ...def,
      runtime_versions: {
        ...def.runtime_versions,
        workflow_definition_version: "literary_agent_review@v999",
      },
    };
    const result = validateExpertRuntimeDefinition(tampered);
    assert.equal(result.ok, false);
  });

  it("recomputing after an intentional authoritative-field change passes", () => {
    const def = literaryAgentRuntimeDefinition();
    const changed = withRuntimeDefinitionHash({
      ...def,
      purpose: `${def.purpose} (audit note)`,
    });
    const result = validateExpertRuntimeDefinition(changed);
    assert.equal(result.ok, true);
    assert.notEqual(changed.runtime_versions.definition_hash, def.runtime_versions.definition_hash);
  });

  it("definition_hash remains excluded from its own hash input", () => {
    const def = literaryAgentRuntimeDefinition();
    const alternateStoredHash = {
      ...def,
      runtime_versions: {
        ...def.runtime_versions,
        definition_hash: "0".repeat(64),
      },
    };
    assert.equal(
      hashExpertRuntimeDefinition(alternateStoredHash),
      hashExpertRuntimeDefinition(def),
    );
  });

  it("uppercase definition_hash is rejected", () => {
    const def = literaryAgentRuntimeDefinition();
    const uppercase = def.runtime_versions.definition_hash.toUpperCase();
    const tampered = {
      ...def,
      runtime_versions: { ...def.runtime_versions, definition_hash: uppercase },
    };
    const result = validateExpertRuntimeDefinition(tampered);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("definition_hash")));
    }
  });

  it("truncated definition_hash is rejected", () => {
    const def = literaryAgentRuntimeDefinition();
    const tampered = {
      ...def,
      runtime_versions: {
        ...def.runtime_versions,
        definition_hash: def.runtime_versions.definition_hash.slice(0, 63),
      },
    };
    const result = validateExpertRuntimeDefinition(tampered);
    assert.equal(result.ok, false);
  });

  it("hashing is deterministic across repeated calls", () => {
    const def = literaryAgentRuntimeDefinition();
    assert.equal(hashExpertRuntimeDefinition(def), hashExpertRuntimeDefinition(def));
    assert.equal(hashExpertRuntimeDefinition(def), EXPECTED_RUNTIME_DEFINITION_HASH);
  });

  it("registration rejects a definition with a stale hash", () => {
    clearExpertRuntimeRegistryForTests();
    const def = literaryAgentRuntimeDefinition();
    const stale = {
      ...def,
      runtime_versions: {
        ...def.runtime_versions,
        definition_hash: PREVIOUS_RUNTIME_DEFINITION_HASH,
      },
    };
    assert.throws(
      () => registerExpertRuntimeDefinition(stale),
      ExpertRegistryError,
    );
  });

  it("P2-06 migration changed runtime hash exactly once for version-set expansion", () => {
    const def = literaryAgentRuntimeDefinition();
    assert.notEqual(
      def.runtime_versions.definition_hash,
      PREVIOUS_RUNTIME_DEFINITION_HASH,
    );
    assert.equal(def.runtime_versions.definition_hash, EXPECTED_RUNTIME_DEFINITION_HASH);
  });
});
