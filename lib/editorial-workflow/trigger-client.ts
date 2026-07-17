import "server-only";

const TASK_ID = "literary-agent-review";

export async function triggerLiteraryAgentReviewTask(
  workflowId: string,
): Promise<{ ok: true; runId: string } | { ok: false; error: string }> {
  if (!process.env.TRIGGER_SECRET_KEY) {
    return { ok: false, error: "TRIGGER_SECRET_KEY is not configured." };
  }

  try {
    const { tasks } = await import("@trigger.dev/sdk/v3");
    const handle = await tasks.trigger(TASK_ID, { workflowId });
    return { ok: true, runId: handle.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
