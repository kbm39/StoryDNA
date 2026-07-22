import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import { withRuntimeDefinitionHash } from "../rehash-runtime-definition.ts";
import {
  bootstrapExpertRuntimeRegistry,
  clearExpertRuntimeRegistryForTests,
  getExpertRuntimeDefinition,
  listExpertRuntimeDefinitions,
  registerExpertRuntimeDefinition,
  resolveExpertsByCapability,
  ExpertRegistryError,
} from "./in-code.ts";
import { EXPERT_RUNTIME_SCHEMA_VERSION } from "../types.ts";

describe("in-code expert runtime registry", () => {
  beforeEach(() => {
    clearExpertRuntimeRegistryForTests();
  });

  it("registers Literary Agent on bootstrap", () => {
    bootstrapExpertRuntimeRegistry();
    const entry = getExpertRuntimeDefinition("literary_agent");
    assert.ok(entry);
    assert.equal(entry!.definition.expert_key, "literary_agent");
    assert.equal(entry!.definition.schema_version, EXPERT_RUNTIME_SCHEMA_VERSION);
  });

  it("resolves Literary Agent by expert key", () => {
    bootstrapExpertRuntimeRegistry();
    const entry = getExpertRuntimeDefinition("literary_agent");
    assert.ok(entry);
    assert.match(entry!.definitionHash, /^[a-f0-9]{64}$/);
  });

  it("resolves Literary Agent by commercial_analysis capability", () => {
    bootstrapExpertRuntimeRegistry();
    const matches = resolveExpertsByCapability("commercial_analysis");
    assert.equal(matches.length, 1);
    assert.equal(matches[0]!.definition.expert_key, "literary_agent");
  });

  it("rejects duplicate expert key registration", () => {
    bootstrapExpertRuntimeRegistry();
    const def = literaryAgentRuntimeDefinition();
    assert.throws(
      () => registerExpertRuntimeDefinition({ ...def, expert_version: "v9.9.9" }),
      ExpertRegistryError,
    );
  });

  it("rejects invalid runtime definition", () => {
    clearExpertRuntimeRegistryForTests();
    const def = literaryAgentRuntimeDefinition();
    assert.throws(
      () =>
        registerExpertRuntimeDefinition({
          ...def,
          expert_key: "",
        }),
      ExpertRegistryError,
    );
  });

  it("excludes disabled expert from default list", () => {
    clearExpertRuntimeRegistryForTests();
    const def = withRuntimeDefinitionHash({
      ...literaryAgentRuntimeDefinition(),
      enabled: false,
    });
    registerExpertRuntimeDefinition(def);
    assert.equal(listExpertRuntimeDefinitions().length, 0);
    assert.ok(getExpertRuntimeDefinition("literary_agent", { includeDisabled: true }));
  });

  it("returns immutable registered definition", () => {
    bootstrapExpertRuntimeRegistry();
    const entry = getExpertRuntimeDefinition("literary_agent", { includeDisabled: true });
    assert.throws(() => {
      (entry!.definition as { display_name: string }).display_name = "Changed";
    });
  });

  it("exposes version metadata", () => {
    bootstrapExpertRuntimeRegistry();
    const entry = getExpertRuntimeDefinition("literary_agent");
    assert.ok(entry!.definition.runtime_versions.engine_version);
    assert.ok(entry!.definition.runtime_versions.rubric_version);
  });
});
