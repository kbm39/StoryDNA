import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import {
  expertRegistryError,
  expertRuntimeVersionKey,
  isExpertRegistryError,
  type ExpertRegistryResult,
  type ExpertRuntimeRegistry,
  type ExpertRuntimeRegistryEntryV2,
} from "./multi-version-contract.ts";

const EXPECTED_RUNTIME_DEFINITION_HASH =
  "f4006eaa497dd1d821f30fdac33dcb4869eff68d1af46b1f7401a972020ca50b";

describe("multi-version registry contract types", () => {
  it("expertRuntimeVersionKey matches in-code versionIndex format", () => {
    assert.equal(
      expertRuntimeVersionKey("literary_agent", "v1.0.0-certified"),
      "literary_agent@v1.0.0-certified",
    );
  });

  it("ExpertRegistryResult discriminated union narrows with isExpertRegistryError", () => {
    const success: ExpertRegistryResult<string> = { ok: true, value: "found" };
    const failure = expertRegistryError("expert_not_found", "no such expert", {
      expert_key: "missing",
    });

    assert.equal(isExpertRegistryError(success), false);
    assert.equal(isExpertRegistryError(failure), true);
    if (isExpertRegistryError(failure)) {
      assert.equal(failure.code, "expert_not_found");
      assert.equal(failure.context?.expert_key, "missing");
    }
  });

  it("ExpertRuntimeRegistry interface is structurally satisfiable", () => {
    const def = literaryAgentRuntimeDefinition();
    const entry: ExpertRuntimeRegistryEntryV2 = {
      definition: def,
      definitionHash: EXPECTED_RUNTIME_DEFINITION_HASH,
      registeredAt: new Date(0).toISOString(),
      expertVersionId: null,
      lifecycleStatus: "active",
      isActive: true,
    };

    const stubRegistry: ExpertRuntimeRegistry = {
      getActiveExpertRuntime: () => ({ ok: true, value: entry }),
      getExpertRuntimeByKeyAndVersion: () => ({ ok: true, value: entry }),
      getExpertRuntimeByDefinitionHash: () => ({ ok: true, value: entry }),
      listExpertRuntimeVersions: () => ({
        ok: true,
        value: [
          {
            expertKey: def.expert_key,
            expertVersion: def.expert_version,
            definitionHash: EXPECTED_RUNTIME_DEFINITION_HASH,
            lifecycleStatus: "active",
            enabled: def.enabled,
            registeredAt: entry.registeredAt,
            expertVersionId: null,
          },
        ],
      }),
      existsExpertRuntime: () => ({ ok: true, value: true }),
      registerExpertRuntimeDefinition: () => ({ ok: true, value: entry }),
      resolveExpertVersionId: () => ({ ok: true, value: null }),
    };

    const active = stubRegistry.getActiveExpertRuntime("literary_agent");
    assert.equal(active.ok, true);
    if (active.ok) {
      assert.equal(active.value.definitionHash, EXPECTED_RUNTIME_DEFINITION_HASH);
      assert.equal(active.value.lifecycleStatus, "active");
    }
  });

  it("all error codes are assignable to ExpertRegistryErrorCode", () => {
    const codes = [
      "expert_not_found",
      "version_not_found",
      "definition_hash_not_found",
      "duplicate_version",
      "conflicting_definition_hash",
      "no_active_version",
      "invalid_lookup",
    ] as const;

    for (const code of codes) {
      const err = expertRegistryError(code, `test ${code}`);
      assert.equal(err.code, code);
      assert.equal(err.ok, false);
    }
  });
});
