import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertPlatformExpertWriteAllowed,
  isPlatformExpert,
} from "./platform-guard.ts";

describe("platform-guard", () => {
  it("allows platform writes with seed context", () => {
    assert.doesNotThrow(() =>
      assertPlatformExpertWriteAllowed({ scope: "platform", context: "seed" }),
    );
  });

  it("allows platform writes with admin context", () => {
    assert.doesNotThrow(() =>
      assertPlatformExpertWriteAllowed({ scope: "platform", context: "admin" }),
    );
  });

  it("blocks platform writes without privileged context", () => {
    assert.throws(
      () =>
        assertPlatformExpertWriteAllowed({
          scope: "platform",
          context: "user_provided" as never,
        }),
      /PLATFORM_EXPERT_WRITE_FORBIDDEN/,
    );
  });

  it("allows platform writes with system context", () => {
    assert.doesNotThrow(() =>
      assertPlatformExpertWriteAllowed({ scope: "platform", context: "system" }),
    );
  });

  it("does not restrict project-scoped writes", () => {
    assert.doesNotThrow(() =>
      assertPlatformExpertWriteAllowed({ scope: "project", context: "system" as never }),
    );
  });

  it("isPlatformExpert identifies platform scope", () => {
    assert.equal(isPlatformExpert("platform"), true);
    assert.equal(isPlatformExpert("project"), false);
  });
});
