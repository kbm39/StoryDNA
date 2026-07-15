import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const ROOT = join(import.meta.dirname, "..");

describe("npm test discovery", () => {
  it("package.json test script includes root and nested lib test globs", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts: { test: string };
    };
    const script = pkg.scripts.test;
    assert.match(script, /lib\/\*\.test\.ts/);
    assert.match(script, /lib\/\*\/\*\.test\.ts/);
    assert.doesNotMatch(script, /lib\/\*\*\/\*\.test\.ts/);
  });

  it("discovers an existing root-level test file and the nested contrary-evidence suite", () => {
    const rootLevel = join(ROOT, "lib/word-count.test.ts");
    const nested = join(ROOT, "lib/contrary-evidence/gate.test.ts");
    assert.equal(existsSync(rootLevel), true, "missing root-level lib/*.test.ts file");
    assert.equal(existsSync(nested), true, "missing nested lib/*/*.test.ts file");
  });
});
