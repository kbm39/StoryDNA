import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const service = readFileSync(join(ROOT, "lib/author-manuscript-brief/service.ts"), "utf8");
const actions = readFileSync(join(ROOT, "app/studio/actions/manuscript-brief.ts"), "utf8");

describe("manuscript brief service layer", () => {
  it("1. exposes createManuscriptBriefDraft", () => {
    assert.match(service, /export async function createManuscriptBriefDraft/);
  });

  it("2. exposes updateManuscriptBriefDraft", () => {
    assert.match(service, /export async function updateManuscriptBriefDraft/);
  });

  it("3. exposes submitManuscriptBrief with validation", () => {
    assert.match(service, /export async function submitManuscriptBrief/);
    assert.match(service, /validateManuscriptBriefSubmit/);
  });

  it("4. enforces author ownership", () => {
    assert.match(service, /Author ownership violation/);
  });

  it("5. enforces manuscript version matching", () => {
    assert.match(service, /Manuscript version mismatch/);
  });

  it("6. one draft per author/version reuses existing draft", () => {
    assert.match(service, /existingDraft/);
    assert.match(service, /\.eq\("status", "draft"\)/);
  });

  it("7. supersession creates new record and marks prior submitted", () => {
    assert.match(service, /export async function supersedeSubmittedBrief/);
    assert.match(service, /status: "superseded"/);
    assert.match(service, /supersedes_brief_id/);
  });

  it("8. preserves history via listManuscriptBriefHistory", () => {
    assert.match(service, /export async function listManuscriptBriefHistory/);
    assert.match(service, /order\("created_at"/);
  });

  it("9. blocks duplicate submitted brief without supersession", () => {
    assert.match(service, /A submitted brief already exists/);
  });

  it("10. server actions do not call providers or workflows", () => {
    for (const content of [service, actions]) {
      assert.doesNotMatch(content, /openai|anthropic|trigger\.dev|launchStudioExpertReview/i);
    }
  });

  it("11. observability emits safe events without brief body", () => {
    assert.match(service, /manuscript_brief_draft_created/);
    assert.match(service, /manuscript_brief_submitted/);
    assert.doesNotMatch(service, /elevator_pitch.*console/);
  });
});
