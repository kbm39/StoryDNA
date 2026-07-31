import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  STUDIO_AUTHOR_INTENT_FLAG_NAME,
  isStudioAuthorIntentEnabled,
} from "./feature-flag.ts";
import { STUDIO_EIC_FLAG_NAME, isStudioEicEnabled } from "@/lib/eic/feature-flag.ts";
import {
  isAuthorIntentEntryGateActive,
  shouldRedirectExpertDeskToAuthorIntent,
  studioExpertRecruitmentHref,
} from "./entry-gate.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("Phase 1A entry gate", () => {
  const savedAuthor = process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME];
  const savedEic = process.env[STUDIO_EIC_FLAG_NAME];
  const savedNodeEnv = process.env.NODE_ENV;

  function restoreEnv() {
    if (savedAuthor === undefined) delete process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME];
    else process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME] = savedAuthor;
    if (savedEic === undefined) delete process.env[STUDIO_EIC_FLAG_NAME];
    else process.env[STUDIO_EIC_FLAG_NAME] = savedEic;
    process.env.NODE_ENV = savedNodeEnv;
  }

  it("1. flags off → legacy Expert Team href", () => {
    delete process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME];
    delete process.env[STUDIO_EIC_FLAG_NAME];
    process.env.NODE_ENV = "development";
    assert.equal(isAuthorIntentEntryGateActive(), false);
    assert.equal(studioExpertRecruitmentHref("book-1"), "/studio/books/book-1/experts");
    restoreEnv();
  });

  it("2. flags on + no active intent → redirect decision true", () => {
    process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME] = "1";
    process.env[STUDIO_EIC_FLAG_NAME] = "1";
    process.env.NODE_ENV = "development";
    assert.equal(isAuthorIntentEntryGateActive(), true);
    assert.equal(
      shouldRedirectExpertDeskToAuthorIntent({
        gateActive: true,
        manuscriptVersionId: "ver-1",
        hasActiveIntent: false,
      }),
      true,
    );
    restoreEnv();
  });

  it("3. flags on + active intent → Expert Team accessible (no redirect)", () => {
    assert.equal(
      shouldRedirectExpertDeskToAuthorIntent({
        gateActive: true,
        manuscriptVersionId: "ver-1",
        hasActiveIntent: true,
      }),
      false,
    );
  });

  it("4. library Run Expert link targets intent when gate active", () => {
    process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME] = "1";
    process.env[STUDIO_EIC_FLAG_NAME] = "1";
    process.env.NODE_ENV = "development";
    assert.equal(studioExpertRecruitmentHref("book-1"), "/studio/books/book-1/intent");
    const librarySource = readFileSync(join(ROOT, "app/studio/books/page.tsx"), "utf8");
    assert.match(librarySource, /studioExpertRecruitmentHref/);
    restoreEnv();
  });

  it("5. book workspace Editorial Team link uses recruitment href helper", () => {
    const workspaceSource = readFileSync(join(ROOT, "app/studio/books/[bookId]/page.tsx"), "utf8");
    assert.match(workspaceSource, /studioExpertRecruitmentHref/);
  });

  it("6. navigation alone does not supersede intent (redirect is read-only)", () => {
    const expertsPage = readFileSync(
      join(ROOT, "app/studio/books/[bookId]/experts/page.tsx"),
      "utf8",
    );
    assert.doesNotMatch(expertsPage, /supersede/i);
    assert.doesNotMatch(expertsPage, /activateAuthorIntent/i);
    assert.doesNotMatch(expertsPage, /createAuthorIntent/i);
  });

  it("7. redirect layer never launches provider or workflow", () => {
    const entryGate = readFileSync(join(ROOT, "lib/author-intent/entry-gate.ts"), "utf8");
    const expertsPage = readFileSync(
      join(ROOT, "app/studio/books/[bookId]/experts/page.tsx"),
      "utf8",
    );
    for (const content of [entryGate, expertsPage]) {
      assert.doesNotMatch(content, /startLiteraryAgent|startMilitaryExpert|openai|anthropic/i);
      assert.doesNotMatch(content, /launchStudioExpertReview/i);
    }
  });

  it("8. historical report routes unchanged", () => {
    const expertsPage = readFileSync(
      join(ROOT, "app/studio/books/[bookId]/experts/page.tsx"),
      "utf8",
    );
    assert.doesNotMatch(expertsPage, /\/manuscripts\//);
    assert.match(expertsPage, /EditorialTeamClient/);
  });

  it('9. feature-flag parser accepts value "1"', () => {
    process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME] = "1";
    process.env[STUDIO_EIC_FLAG_NAME] = "1";
    process.env.NODE_ENV = "development";
    assert.equal(isStudioAuthorIntentEnabled(), true);
    assert.equal(isStudioEicEnabled(), true);
    assert.equal(isAuthorIntentEntryGateActive(), true);
    restoreEnv();
  });

  it("experts page uses server-side redirect when gate active and no intent", () => {
    const expertsPage = readFileSync(
      join(ROOT, "app/studio/books/[bookId]/experts/page.tsx"),
      "utf8",
    );
    assert.match(expertsPage, /redirect\s*\(/);
    assert.match(expertsPage, /isAuthorIntentEntryGateActive/);
    assert.match(expertsPage, /getActiveAuthorIntent/);
    assert.match(expertsPage, /shouldRedirectExpertDeskToAuthorIntent/);
  });
});
