import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  runStoryDnaInfraPing,
  STORYDNA_INFRA_PING_TASK_ID,
} from "./storydna-infra-ping.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PING_FILE = join(ROOT, "trigger/storydna-infra-ping.ts");

const FORBIDDEN_SUBSTRINGS = [
  "runFreshEditorialGeneration",
  "executeLiteraryAgentWorkflow",
  "literary-agent-review",
  "start-literary-agent-workflow",
  "editorial-generation",
  "@anthropic-ai/sdk",
  "lib/ai/anthropic",
  "openai",
  "editorial_workflows",
];

const IMPORT_RE =
  /(?:from|import)\s+["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)/g;

function collectLocalImportGraph(entryFile: string): string[] {
  const visited = new Set<string>();
  const queue = [resolve(entryFile)];

  while (queue.length > 0) {
    const file = queue.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    const src = readFileSync(file, "utf8");
    for (const match of src.matchAll(IMPORT_RE)) {
      const spec = match[1] ?? match[2];
      if (!spec) continue;
      if (spec.startsWith("@trigger.dev/")) continue;
      if (!spec.startsWith(".") && !spec.startsWith("@/")) {
        continue;
      }
      const base = spec.startsWith("@/")
        ? join(ROOT, spec.slice(2))
        : resolve(dirname(file), spec);
      const candidates = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        join(base, "index.ts"),
      ];
      const next = candidates.find((c) => existsSync(c));
      if (next) queue.push(next);
    }
  }

  return [...visited];
}

describe("storydna-infra-ping", () => {
  it("returns deterministic success metadata", () => {
    const result = runStoryDnaInfraPing({
      requestId: "smoke-1",
      source: "local-smoke",
    });
    assert.deepEqual(result, {
      ok: true,
      requestId: "smoke-1",
      taskId: "storydna-infra-ping",
    });
    assert.equal(STORYDNA_INFRA_PING_TASK_ID, "storydna-infra-ping");
  });

  it("does not import Literary Agent, editorial-generation, or AI providers", () => {
    const files = collectLocalImportGraph(PING_FILE);
    assert.deepEqual(files, [PING_FILE]);
    const src = readFileSync(PING_FILE, "utf8");
    for (const forbidden of FORBIDDEN_SUBSTRINGS) {
      assert.doesNotMatch(
        src,
        new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        `ping task must not reference ${forbidden}`,
      );
    }
    assert.match(src, /from "@trigger\.dev\/sdk\/v3"/);
    assert.doesNotMatch(src, /from ["']openai["']/);
    assert.doesNotMatch(src, /from ["']@anthropic-ai\/sdk["']/);
    assert.doesNotMatch(src, /literary-agent-cost/);
    assert.doesNotMatch(src, /costAccounting|cost_accounting/);
  });
});
