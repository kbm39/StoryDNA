import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  isStudioPeuAntiEchoEnabled,
  isStudioPeuProviderSynthesisEnabled,
  isStudioProgressiveEditorialUnderstandingEnabled,
  isStudioProgressiveEditorialUnderstandingFlagSet,
  STUDIO_PEU_ANTI_ECHO_FLAG_NAME,
  STUDIO_PEU_PROVIDER_SYNTHESIS_FLAG_NAME,
  STUDIO_PROGRESSIVE_EDITORIAL_UNDERSTANDING_FLAG_NAME,
} from "./feature-flag.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("STUDIO_PROGRESSIVE_EDITORIAL_UNDERSTANDING_ENABLED flag", () => {
  it("1. flag name is STUDIO_PROGRESSIVE_EDITORIAL_UNDERSTANDING_ENABLED", () => {
    assert.equal(
      STUDIO_PROGRESSIVE_EDITORIAL_UNDERSTANDING_FLAG_NAME,
      "STUDIO_PROGRESSIVE_EDITORIAL_UNDERSTANDING_ENABLED",
    );
  });

  it("2. default off when env unset", () => {
    const previous = process.env[STUDIO_PROGRESSIVE_EDITORIAL_UNDERSTANDING_FLAG_NAME];
    delete process.env[STUDIO_PROGRESSIVE_EDITORIAL_UNDERSTANDING_FLAG_NAME];
    assert.equal(isStudioProgressiveEditorialUnderstandingFlagSet(), false);
    if (previous !== undefined) {
      process.env[STUDIO_PROGRESSIVE_EDITORIAL_UNDERSTANDING_FLAG_NAME] = previous;
    }
  });

  it("3. documented in .env.example", () => {
    const envExample = readFileSync(join(ROOT, ".env.example"), "utf8");
    assert.match(envExample, /STUDIO_PROGRESSIVE_EDITORIAL_UNDERSTANDING_ENABLED=0/);
    assert.match(envExample, /STUDIO_CONVERSATIONAL_INTELLIGENCE_ENABLED=1/);
    assert.match(envExample, /STUDIO_EIC_CONVERSATIONAL_INTAKE_ENABLED=1/);
    assert.match(envExample, /STUDIO_AUTHOR_INTENT_ENABLED=1/);
    assert.match(envExample, /STUDIO_EIC_ENABLED=1/);
  });

  it("4. production always disables progressive editorial understanding", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    process.env[STUDIO_PROGRESSIVE_EDITORIAL_UNDERSTANDING_FLAG_NAME] = "1";
    assert.equal(isStudioProgressiveEditorialUnderstandingEnabled(), false);
    process.env.NODE_ENV = previousNodeEnv;
  });

  it("5. anti-echo and provider synthesis flags require master flag", () => {
    assert.equal(STUDIO_PEU_ANTI_ECHO_FLAG_NAME, "STUDIO_PEU_ANTI_ECHO_ENABLED");
    assert.equal(STUDIO_PEU_PROVIDER_SYNTHESIS_FLAG_NAME, "STUDIO_PEU_PROVIDER_SYNTHESIS_ENABLED");
    assert.equal(isStudioPeuAntiEchoEnabled(), false);
    assert.equal(isStudioPeuProviderSynthesisEnabled(), false);
  });
});

describe("Phase 1B-ab backward compatibility with PEU flag off", () => {
  it("existing CI behavior preserved when PEU disabled", () => {
    const previous = process.env[STUDIO_PROGRESSIVE_EDITORIAL_UNDERSTANDING_FLAG_NAME];
    delete process.env[STUDIO_PROGRESSIVE_EDITORIAL_UNDERSTANDING_FLAG_NAME];
    assert.equal(isStudioProgressiveEditorialUnderstandingEnabled(), false);
    if (previous !== undefined) {
      process.env[STUDIO_PROGRESSIVE_EDITORIAL_UNDERSTANDING_FLAG_NAME] = previous;
    }
  });
});
