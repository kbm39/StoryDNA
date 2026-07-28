#!/usr/bin/env node
/**
 * Cancel an editorial workflow by ID using the shared cancellation path.
 * Usage: node --import ./scripts/test-path-alias.mjs --env-file=.env.local --experimental-strip-types scripts/cancel-editorial-workflow.mjs <workflowId>
 */
import { cancelEditorialWorkflow } from "../lib/editorial-workflow/cancel-workflow.ts";

const workflowId = process.argv[2];
if (!workflowId) {
  console.error("Usage: cancel-editorial-workflow.mjs <workflowId>");
  process.exit(1);
}

const result = await cancelEditorialWorkflow(workflowId);
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
