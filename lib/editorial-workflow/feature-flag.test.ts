import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { isEditorialWorkflowEnabled, isEditorialWorkflowDevSyncFallback } from "./feature-flag.ts";

describe("feature-flag", () => {
  let enabled: string | undefined;
  let devFallback: string | undefined;
  let nodeEnv: string | undefined;

  beforeEach(() => {
    enabled = process.env.EDITORIAL_WORKFLOW_ENABLED;
    devFallback = process.env.EDITORIAL_WORKFLOW_DEV_SYNC_FALLBACK;
    nodeEnv = process.env.NODE_ENV;
    delete process.env.EDITORIAL_WORKFLOW_ENABLED;
    delete process.env.EDITORIAL_WORKFLOW_DEV_SYNC_FALLBACK;
  });

  afterEach(() => {
    if (enabled === undefined) delete process.env.EDITORIAL_WORKFLOW_ENABLED;
    else process.env.EDITORIAL_WORKFLOW_ENABLED = enabled;
    if (devFallback === undefined) delete process.env.EDITORIAL_WORKFLOW_DEV_SYNC_FALLBACK;
    else process.env.EDITORIAL_WORKFLOW_DEV_SYNC_FALLBACK = devFallback;
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
  });

  it("defaults workflow flag to off", () => {
    assert.equal(isEditorialWorkflowEnabled(), false);
  });

  it("enables workflow flag with 1 or true", () => {
    process.env.EDITORIAL_WORKFLOW_ENABLED = "1";
    assert.equal(isEditorialWorkflowEnabled(), true);
    process.env.EDITORIAL_WORKFLOW_ENABLED = "true";
    assert.equal(isEditorialWorkflowEnabled(), true);
  });

  it("never enables dev sync fallback in production", () => {
    process.env.NODE_ENV = "production";
    process.env.EDITORIAL_WORKFLOW_DEV_SYNC_FALLBACK = "1";
    assert.equal(isEditorialWorkflowDevSyncFallback(), false);
  });
});
