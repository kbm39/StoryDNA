import assert from "node:assert/strict";
import { existsSync, globSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LIB_TEST_GLOB = "lib/**/*.test.ts";

function readPackageJson() {
  return JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    engines?: { node?: string };
    scripts: { test: string };
  };
}

describe("npm test discovery", () => {
  it("package.json declares Node >=22.0.0", () => {
    const pkg = readPackageJson();
    assert.equal(pkg.engines?.node, ">=22.0.0");
  });

  it("package.json test script uses native quoted lib/**/*.test.ts glob", () => {
    const script = readPackageJson().scripts.test;
    assert.match(script, /lib\/\*\*\/\*\.test\.ts/);
    assert.match(script, /"lib\/\*\*\/\*\.test\.ts"/);
    assert.doesNotMatch(script, /discover-lib-test-files\.mjs/);
    assert.doesNotMatch(script, /run-lib-tests\.mjs/);
    assert.doesNotMatch(script, /lib\/\*\/\*\.test\.ts/);
    assert.doesNotMatch(script, /lib\/\*\/\*\/\*\.test\.ts/);
    assert.doesNotMatch(script, /lib\/\*\.test\.ts lib/);
  });

  it("discovers every current lib/**/*.test.ts file recursively", () => {
    const discovered = globSync(LIB_TEST_GLOB, { cwd: ROOT }).sort();
    assert.equal(discovered.length, 50, "expected exactly 50 lib test files");
    assert.ok(
      discovered.includes("lib/word-count.test.ts"),
      "missing root-level lib test",
    );
    assert.ok(
      discovered.includes("lib/expert-review-engine/registry/in-code.test.ts"),
      "missing depth-3 lib test",
    );
  });

  it("recursive glob matches paths deeper than the prior three-level limit", () => {
    const tempRoot = mkdirSync(join(tmpdir(), `storydna-test-discovery-${Date.now()}`), {
      recursive: true,
    });
    const deepDir = join(tempRoot, "lib", "a", "b", "c", "d");
    mkdirSync(deepDir, { recursive: true });
    writeFileSync(join(deepDir, "fixture.test.ts"), "export {};\n");

    try {
      const matches = globSync(LIB_TEST_GLOB, { cwd: tempRoot }).sort();
      assert.deepEqual(matches, ["lib/a/b/c/d/fixture.test.ts"]);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("globSync inventory is deterministic with no duplicates", () => {
    const first = globSync(LIB_TEST_GLOB, { cwd: ROOT }).sort();
    const second = globSync(LIB_TEST_GLOB, { cwd: ROOT }).sort();
    assert.deepEqual(first, second);
    assert.equal(first.length, new Set(first).size, "duplicate test file paths");
    for (let i = 1; i < first.length; i++) {
      assert.ok(
        first[i - 1]!.localeCompare(first[i]!) <= 0,
        `paths out of order: ${first[i - 1]} then ${first[i]}`,
      );
    }
  });

  it("rejects regression to depth-limited shell globs and custom runners", () => {
    const script = readPackageJson().scripts.test;
    assert.equal(script.includes("lib/*/*.test.ts"), false);
    assert.equal(script.includes("lib/*/*/*.test.ts"), false);
    assert.equal(script.includes("discover-lib-test-files.mjs"), false);
    assert.equal(script.includes("run-lib-tests.mjs"), false);
  });

  it("discovers an existing root-level test file and the nested contrary-evidence suite", () => {
    const rootLevel = join(ROOT, "lib/word-count.test.ts");
    const nested = join(ROOT, "lib/contrary-evidence/gate.test.ts");
    assert.equal(existsSync(rootLevel), true, "missing root-level lib/*.test.ts file");
    assert.equal(existsSync(nested), true, "missing nested lib/*/*.test.ts file");
    const discovered = globSync(LIB_TEST_GLOB, { cwd: ROOT });
    assert.ok(discovered.includes("lib/word-count.test.ts"));
    assert.ok(discovered.includes("lib/contrary-evidence/gate.test.ts"));
  });
});
