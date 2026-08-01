import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { INTAKE_PROMPT_COUNT } from "./contract.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("Phase 1B-a conversational intake UI", () => {
  const intakeClient = readFileSync(
    join(ROOT, "app/studio/books/[bookId]/intent/ConversationalIntakeClient.tsx"),
    "utf8",
  );
  const intentPage = readFileSync(
    join(ROOT, "app/studio/books/[bookId]/intent/page.tsx"),
    "utf8",
  );
  const briefActions = readFileSync(
    join(ROOT, "app/studio/actions/manuscript-brief.ts"),
    "utf8",
  );

  it("1. welcome screen uses EIC conversational copy", () => {
    assert.match(
      intakeClient,
      /Before I read your manuscript, I&apos;d like to hear about it in your own words/,
    );
  });

  it("2. questions appear in PRD order", () => {
    const questions = [
      "What is your manuscript about?",
      "Why did you write it?",
      "What experience do you want readers to have?",
      "Where do you see it in the market?",
      "Are there books, films, or shows you would compare it to?",
      "What would make this editorial process feel successful to you?",
    ];
    let lastIndex = -1;
    for (const q of questions) {
      const idx = intakeClient.indexOf(q);
      assert.ok(idx > lastIndex, `Question out of order: ${q}`);
      lastIndex = idx;
    }
    assert.equal(questions.length, INTAKE_PROMPT_COUNT);
  });

  it("3. save draft is available during intake", () => {
    assert.match(intakeClient, /Save draft & exit/);
    assert.match(briefActions, /saveManuscriptBriefDraftAction/);
  });

  it("4. optional questions may be skipped", () => {
    assert.match(intakeClient, /Skip this question/);
    assert.match(intakeClient, /optional: true/);
  });

  it("5. submit requires elevator pitch minimum length", () => {
    assert.match(intakeClient, /elevator_pitch\.trim\(\)\.length < 10/);
    assert.match(briefActions, /submitManuscriptBriefAction/);
  });

  it("6. acknowledgment appears after submission stage", () => {
    assert.match(intakeClient, /stage === "acknowledgment"/);
    assert.match(intakeClient, /treated as evidence/);
    assert.match(intakeClient, /No expert has received your manuscript/);
  });

  it("7. expert controls are not shown in conversational intake", () => {
    assert.doesNotMatch(intakeClient, /requested_experts|declined_experts|PRIORITY_DOMAINS/);
    assert.doesNotMatch(intakeClient, /ExpertPlanList|KNOWN_EXPERT_KEYS/);
  });

  it("8. no provider call or expert workflow launch", () => {
    for (const content of [intakeClient, briefActions, intentPage]) {
      assert.doesNotMatch(content, /startLiteraryAgent|startMilitaryExpert|openai|anthropic/i);
      assert.doesNotMatch(content, /launchStudioExpertReview|trigger\.dev/i);
    }
  });

  it("9. Continue after acknowledgment does not launch workflow", () => {
    assert.match(intakeClient, /independent read is the next stage/);
    assert.match(intakeClient, /no provider or expert review is running/);
    assert.doesNotMatch(intakeClient, /launchStudioExpertReview/);
  });

  it("10. page routes to conversational client when flag enabled", () => {
    assert.match(intentPage, /getConversationalIntakePageData/);
    assert.match(intentPage, /ConversationalIntakeClient/);
    assert.match(intentPage, /AuthorIntentClient/);
    assert.match(intentPage, /conversationalEnabled/);
  });

  it("11. accessibility: labeled inputs and progress", () => {
    assert.match(intakeClient, /sr-only/);
    assert.match(intakeClient, /aria-required/);
    assert.match(intakeClient, /Step \$\{step \+ 1\} of/);
    assert.match(intakeClient, /aria-label="Editor-in-Chief"/);
  });

  it("12. tablet and desktop layout uses responsive max width", () => {
    assert.match(intakeClient, /max-w-xl/);
    assert.match(intakeClient, /flex-wrap/);
  });
});

describe("Phase 1B-a backward compatibility", () => {
  it("Phase 1A AuthorIntentClient preserved when conversational flag off", () => {
    const intentPage = readFileSync(
      join(ROOT, "app/studio/books/[bookId]/intent/page.tsx"),
      "utf8",
    );
    assert.match(intentPage, /AuthorIntentClient/);
    const authorIntentClient = readFileSync(
      join(ROOT, "app/studio/books/[bookId]/intent/AuthorIntentClient.tsx"),
      "utf8",
    );
    assert.match(authorIntentClient, /AUTHOR_INTENT_TYPES/);
  });
});
