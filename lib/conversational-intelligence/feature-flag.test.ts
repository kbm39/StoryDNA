import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  isStudioConversationalIntelligenceEnabled,
  isStudioConversationalIntelligenceFlagSet,
  STUDIO_CONVERSATIONAL_INTELLIGENCE_FLAG_NAME,
} from "./feature-flag.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("STUDIO_CONVERSATIONAL_INTELLIGENCE_ENABLED flag", () => {
  it("1. flag name is STUDIO_CONVERSATIONAL_INTELLIGENCE_ENABLED", () => {
    assert.equal(STUDIO_CONVERSATIONAL_INTELLIGENCE_FLAG_NAME, "STUDIO_CONVERSATIONAL_INTELLIGENCE_ENABLED");
  });

  it("2. default off when env unset", () => {
    const previous = process.env[STUDIO_CONVERSATIONAL_INTELLIGENCE_FLAG_NAME];
    delete process.env[STUDIO_CONVERSATIONAL_INTELLIGENCE_FLAG_NAME];
    assert.equal(isStudioConversationalIntelligenceFlagSet(), false);
    if (previous !== undefined) process.env[STUDIO_CONVERSATIONAL_INTELLIGENCE_FLAG_NAME] = previous;
  });

  it("3. requires conversational intake and author intent flags", () => {
    const envExample = readFileSync(join(ROOT, ".env.example"), "utf8");
    assert.match(envExample, /STUDIO_CONVERSATIONAL_INTELLIGENCE_ENABLED=0/);
    assert.match(envExample, /STUDIO_EIC_CONVERSATIONAL_INTAKE_ENABLED=1/);
    assert.match(envExample, /STUDIO_AUTHOR_INTENT_ENABLED=1/);
    assert.match(envExample, /STUDIO_EIC_ENABLED=1/);
  });

  it("4. production always disables conversational intelligence", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    process.env[STUDIO_CONVERSATIONAL_INTELLIGENCE_FLAG_NAME] = "1";
    assert.equal(isStudioConversationalIntelligenceEnabled(), false);
    process.env.NODE_ENV = previousNodeEnv;
  });
});

describe("Phase 1B-ab backward compatibility", () => {
  it("Phase 1B-a ConversationalIntakeClient preserved when CI flag off", () => {
    const intentPage = readFileSync(
      join(ROOT, "app/studio/books/[bookId]/intent/page.tsx"),
      "utf8",
    );
    assert.match(intentPage, /ConversationalIntakeClient/);
    assert.match(intentPage, /ConversationalIntelligenceClient/);
    assert.match(intentPage, /intelligenceEnabled/);
    assert.match(intentPage, /conversationalEnabled/);
  });
});
