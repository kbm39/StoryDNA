import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import { LITERARY_AGENT } from "@/lib/ai/review-engine.ts";
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
import { EXPERT_RUNTIME_SCHEMA_VERSION, hashExpertRuntimeDefinition } from "../types.ts";
import { validateExpertRuntimeDefinition } from "../validate-runtime-definition.ts";

const EXPECTED_LA_DEFINITION_HASH =
  "d24ed5215515233b4e2819c0ea527dd8d843b7f2e949587380ca63c38c4c2588";

function expectMutationFailure(fn: () => void): void {
  assert.throws(fn, TypeError);
}

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

describe("in-code expert runtime registry — deep immutability", () => {
  beforeEach(() => {
    clearExpertRuntimeRegistryForTests();
  });

  it("rejects nested object mutation on registered Literary Agent definition", () => {
    bootstrapExpertRuntimeRegistry();
    const entry = getExpertRuntimeDefinition("literary_agent", { includeDisabled: true });
    assert.ok(entry);

    expectMutationFailure(() => {
      entry!.definition.personality.traits.push("rogue");
    });
    expectMutationFailure(() => {
      entry!.definition.personality.archetype = "Changed";
    });
  });

  it("rejects nested array mutations including push, pop, and splice", () => {
    bootstrapExpertRuntimeRegistry();
    const def = getExpertRuntimeDefinition("literary_agent", { includeDisabled: true })!.definition;

    expectMutationFailure(() => {
      def.capabilities.push("proofreading");
    });
    expectMutationFailure(() => {
      def.capabilities.pop();
    });
    expectMutationFailure(() => {
      def.capabilities.splice(0, 1);
    });
    expectMutationFailure(() => {
      def.knowledge_domains[0]!.authorities.push("New Authority");
    });
  });

  it("rejects plugin definition mutation", () => {
    bootstrapExpertRuntimeRegistry();
    const def = getExpertRuntimeDefinition("literary_agent", { includeDisabled: true })!.definition;
    const plugin = def.validation_plugins[0]!;

    expectMutationFailure(() => {
      (plugin as { exportName: string }).exportName = "otherExport";
    });
    expectMutationFailure(() => {
      def.validation_plugins.push({
        id: "rogue",
        moduleId: "@/lib/foo",
        exportName: "foo",
        stage: "pre_memo",
        failClosed: true,
      });
    });
  });

  it("rejects runtime_versions mutation", () => {
    bootstrapExpertRuntimeRegistry();
    const versions = getExpertRuntimeDefinition("literary_agent", { includeDisabled: true })!
      .definition.runtime_versions;

    expectMutationFailure(() => {
      (versions as { engine_version: string }).engine_version = "mutated";
    });
    expectMutationFailure(() => {
      (versions as { definition_hash: string }).definition_hash = "0".repeat(64);
    });
  });

  it("rejects routing metadata mutation", () => {
    bootstrapExpertRuntimeRegistry();
    const rules = getExpertRuntimeDefinition("literary_agent", { includeDisabled: true })!
      .definition.editor_in_chief_rules;

    expectMutationFailure(() => {
      rules.compatibleExperts.push("other_expert");
    });
    expectMutationFailure(() => {
      rules.escalationExperts = [];
    });
  });

  it("returns the same deeply frozen definition across retrievals", () => {
    bootstrapExpertRuntimeRegistry();
    const first = getExpertRuntimeDefinition("literary_agent", { includeDisabled: true });
    const second = getExpertRuntimeDefinition("literary_agent", { includeDisabled: true });
    assert.equal(first!.definition, second!.definition);
    assert.ok(Object.isFrozen(first!.definition.validation_plugins));
    assert.ok(Object.isFrozen(first!.definition.runtime_versions));
  });

  it("does not mutate the source definition object passed to registration", () => {
    clearExpertRuntimeRegistryForTests();
    const source = literaryAgentRuntimeDefinition();
    const capabilitiesBefore = [...source.capabilities];
    const pluginExportBefore = source.validation_plugins[0]!.exportName;
    const reportSectionsBefore = [...source.export_policy.reportSections];

    registerExpertRuntimeDefinition(source);

    // Mutate only fields that are cloned snapshots, not shared ReviewerDefinition references.
    source.capabilities.push("proofreading");
    source.validation_plugins[0]!.exportName = "mutatedExport";
    source.export_policy.reportSections.push("extra_section");

    assert.deepEqual(source.capabilities, [...capabilitiesBefore, "proofreading"]);
    assert.equal(source.validation_plugins[0]!.exportName, "mutatedExport");
    assert.deepEqual(source.export_policy.reportSections, [...reportSectionsBefore, "extra_section"]);

    const registered = getExpertRuntimeDefinition("literary_agent", { includeDisabled: true })!;
    assert.deepEqual(registered.definition.capabilities, capabilitiesBefore);
    assert.equal(registered.definition.validation_plugins[0]!.exportName, pluginExportBefore);
    assert.deepEqual(registered.definition.export_policy.reportSections, reportSectionsBefore);
  });

  it("does not mutate the certified ReviewerDefinition source object", () => {
    const traitsBefore = [...LITERARY_AGENT.personality.traits];

    clearExpertRuntimeRegistryForTests();
    registerExpertRuntimeDefinition(literaryAgentRuntimeDefinition());

    assert.deepEqual(LITERARY_AGENT.personality.traits, traitsBefore);
  });

  it("keeps bootstrap registration deterministic", () => {
    clearExpertRuntimeRegistryForTests();
    bootstrapExpertRuntimeRegistry();
    const firstHash = getExpertRuntimeDefinition("literary_agent")!.definitionHash;

    clearExpertRuntimeRegistryForTests();
    bootstrapExpertRuntimeRegistry();
    const secondHash = getExpertRuntimeDefinition("literary_agent")!.definitionHash;

    assert.equal(firstHash, secondHash);
    assert.equal(firstHash, EXPECTED_LA_DEFINITION_HASH);
  });

  it("preserves Literary Agent definition hash and validation", () => {
    clearExpertRuntimeRegistryForTests();
    bootstrapExpertRuntimeRegistry();
    const entry = getExpertRuntimeDefinition("literary_agent", { includeDisabled: true });
    assert.ok(entry);

    assert.equal(entry!.definitionHash, EXPECTED_LA_DEFINITION_HASH);
    assert.equal(hashExpertRuntimeDefinition(entry!.definition), EXPECTED_LA_DEFINITION_HASH);
    assert.equal(validateExpertRuntimeDefinition(entry!.definition).ok, true);
  });

  it("rejects delete and replace on nested properties", () => {
    bootstrapExpertRuntimeRegistry();
    const def = getExpertRuntimeDefinition("literary_agent", { includeDisabled: true })!.definition;

    expectMutationFailure(() => {
      delete (def.prompt_builder as { reviewerDefinitionExport?: string }).reviewerDefinitionExport;
    });
    expectMutationFailure(() => {
      def.export_policy = { reportSections: [] };
    });
    expectMutationFailure(() => {
      def.generation_profile = {
        id: "other",
        calls: [{ id: "x", role: "memo" }],
      };
    });
  });
});
