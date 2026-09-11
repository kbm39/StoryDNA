import type { ActiveExpertWorkflow, ExpertExecutionOptions, ExecuteExpertRequest } from "./types.ts";

export class DuplicateActiveWorkflowError extends Error {
  readonly existing: ActiveExpertWorkflow;
  constructor(existing: ActiveExpertWorkflow) {
    super("DUPLICATE_ACTIVE_EXPERT_WORKFLOW");
    this.name = "DuplicateActiveWorkflowError";
    this.existing = existing;
  }
}

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

export async function assertNoDuplicateActiveWorkflow(
  request: ExecuteExpertRequest,
  options: ExpertExecutionOptions,
): Promise<void> {
  if (!options.findActiveWorkflow) return;
  const existing = await options.findActiveWorkflow({
    expert_key: request.expert_key,
    manuscript_id: request.manuscript_id,
    manuscript_version_id: request.manuscript_version_id,
  });
  if (existing && !TERMINAL.has(existing.status)) {
    throw new DuplicateActiveWorkflowError(existing);
  }
}
