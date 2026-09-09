import { task } from "@trigger.dev/sdk/v3";

/** Infrastructure-only smoke task. Do not import editorial or AI modules. */
export const STORYDNA_INFRA_PING_TASK_ID = "storydna-infra-ping" as const;

export interface StoryDnaInfraPingPayload {
  requestId: string;
  source: "local-smoke";
}

export interface StoryDnaInfraPingResult {
  ok: true;
  requestId: string;
  taskId: typeof STORYDNA_INFRA_PING_TASK_ID;
}

export function runStoryDnaInfraPing(
  payload: StoryDnaInfraPingPayload,
): StoryDnaInfraPingResult {
  if (typeof payload?.requestId !== "string" || payload.requestId.trim() === "") {
    throw new Error("requestId is required.");
  }
  if (payload.source !== "local-smoke") {
    throw new Error('source must be "local-smoke".');
  }

  return {
    ok: true,
    requestId: payload.requestId,
    taskId: STORYDNA_INFRA_PING_TASK_ID,
  };
}

export const storyDnaInfraPingTask = task({
  id: STORYDNA_INFRA_PING_TASK_ID,
  retry: {
    maxAttempts: 1,
  },
  run: async (payload: StoryDnaInfraPingPayload) => {
    return runStoryDnaInfraPing(payload);
  },
});
