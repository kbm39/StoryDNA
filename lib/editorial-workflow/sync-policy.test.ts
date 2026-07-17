import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  isLiteraryAgentSyncFromServerActionAllowed,
  LITERARY_AGENT_UNAVAILABLE_MESSAGE,
} from "./sync-policy.ts";

describe("sync-policy", () => {
  let enabled: string | undefined;
  let devFallback: string | undefined;
  let nodeEnv: string | undefined;

  beforeEach(() => {
    enabled = process.env.EDITORIAL_WORKFLOW_ENABLED;
    devFallback = process.env.EDITORIAL_WORKFLOW_DEV_SYNC_FALLBACK;
    nodeEnv = process.env.NODE_ENV;
    process.env.EDITORIAL_WORKFLOW_ENABLED = "0";
    process.env.EDITORIAL_WORKFLOW_DEV_SYNC_FALLBACK = "0";
  });

  afterEach(() => {
    if (enabled === undefined) delete process.env.EDITORIAL_WORKFLOW_ENABLED;
    else process.env.EDITORIAL_WORKFLOW_ENABLED = enabled;
    if (devFallback === undefined) delete process.env.EDITORIAL_WORKFLOW_DEV_SYNC_FALLBACK;
    else process.env.EDITORIAL_WORKFLOW_DEV_SYNC_FALLBACK = devFallback;
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
  });

  it("blocks sync in production", () => {
    process.env.NODE_ENV = "production";
    assert.equal(isLiteraryAgentSyncFromServerActionAllowed(), false);
  });

  it("blocks sync in development when workflow flag is on", () => {
    process.env.NODE_ENV = "development";
    process.env.EDITORIAL_WORKFLOW_ENABLED = "1";
    assert.equal(isLiteraryAgentSyncFromServerActionAllowed(), false);
  });

  it("allows dev sync only with explicit fallback when flag is off", () => {
    process.env.NODE_ENV = "development";
    process.env.EDITORIAL_WORKFLOW_DEV_SYNC_FALLBACK = "1";
    assert.equal(isLiteraryAgentSyncFromServerActionAllowed(), true);
  });

  it("uses calm unavailable copy", () => {
    assert.match(LITERARY_AGENT_UNAVAILABLE_MESSAGE, /temporarily unavailable/i);
    assert.match(LITERARY_AGENT_UNAVAILABLE_MESSAGE, /Publishing Workflow/i);
  });
});
