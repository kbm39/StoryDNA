import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { EIC_INTAKE_STAGE_COUNT } from "./stages.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("Phase 1B-ab conversational intelligence UI", () => {
  const intelligenceClient = readFileSync(
    join(ROOT, "app/studio/books/[bookId]/intent/ConversationalIntelligenceClient.tsx"),
    "utf8",
  );
  const intentPage = readFileSync(
    join(ROOT, "app/studio/books/[bookId]/intent/page.tsx"),
    "utf8",
  );
  const ciActions = readFileSync(
    join(ROOT, "app/studio/actions/conversational-intelligence.ts"),
    "utf8",
  );

  it("1. shows EIC response stage after author answer", () => {
    assert.match(intelligenceClient, /stage === "eic_response"/);
    assert.match(intelligenceClient, /setEicResponse/);
  });

  it("2. supports one clarification follow-up per stage", () => {
    assert.match(intelligenceClient, /stage === "clarification"/);
    assert.match(intelligenceClient, /isClarificationFollowUp/);
    assert.match(ciActions, /isClarificationFollowUp/);
  });

  it("3. confirmation screen asks Did I understand you correctly", () => {
    assert.match(intelligenceClient, /Did I understand you correctly/);
    assert.match(intelligenceClient, /Before I read your manuscript/);
  });

  it("4. confirmation actions include Yes, Edit answers, Correct summary, Save and return later", () => {
    assert.match(intelligenceClient, /\bYes\b/);
    assert.match(intelligenceClient, /Edit answers/);
    assert.match(intelligenceClient, /Correct summary/);
    assert.match(intelligenceClient, /Save and return later/);
  });

  it("5. post-confirmation does not start independent read", () => {
    assert.match(intelligenceClient, /independent read is the next stage/);
    assert.match(intelligenceClient, /no provider or expert review is running/);
    assert.doesNotMatch(intelligenceClient, /launchStudioExpertReview/);
  });

  it("6. progress indicator remains visible — not a chat thread", () => {
    assert.match(intelligenceClient, /Step \$\{step \+ 1\} of/);
    assert.doesNotMatch(intelligenceClient, /messages\.map|chatThread/);
  });

  it("7. six intake stages preserved", () => {
    assert.equal(EIC_INTAKE_STAGE_COUNT, 6);
  });

  it("8. no provider or expert workflow in UI or actions", () => {
    for (const content of [intelligenceClient, ciActions, intentPage]) {
      assert.doesNotMatch(content, /startLiteraryAgent|startMilitaryExpert|openai|anthropic/i);
      assert.doesNotMatch(content, /launchStudioExpertReview|trigger\.dev/i);
    }
  });

  it("9. page routes to intelligence client when flag enabled", () => {
    assert.match(intentPage, /getConversationalIntelligencePageData/);
    assert.match(intentPage, /intelligenceEnabled/);
  });

  it("10. accessibility: EIC messages and progress labels", () => {
    assert.match(intelligenceClient, /aria-label="Editor-in-Chief"/);
    assert.match(intelligenceClient, /aria-valuenow/);
    assert.match(intelligenceClient, /sr-only/);
  });
});
