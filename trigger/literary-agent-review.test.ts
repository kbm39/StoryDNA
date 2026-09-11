import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("literary-agent-review Trigger keep-alive wiring", () => {
  const src = readFileSync(join(ROOT, "trigger/literary-agent-review.ts"), "utf8");

  it("uses installed Trigger 4.5.4 heartbeats.yield and timeout.signal", () => {
    assert.match(src, /import \{ task, heartbeats, timeout \} from "@trigger\.dev\/sdk\/v3"/);
    assert.match(src, /onExecutionHeartbeat: \(\) => heartbeats\.yield\(\)/);
    assert.match(src, /abortSignal: timeout\.signal/);
    assert.match(src, /maxDuration: 3600/);
  });
});
