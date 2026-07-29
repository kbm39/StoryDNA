import type {
  StudioWorkflowActivityEntry,
  StudioWorkflowTimelineStep,
} from "@/lib/studio/types.ts";

function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function stepDotClass(state: StudioWorkflowTimelineStep["state"]): string {
  switch (state) {
    case "completed":
      return "border-accent bg-accent";
    case "current":
      return "border-accent bg-white ring-4 ring-accent/20";
    case "failed":
      return "border-red-500 bg-red-500";
    default:
      return "border-black/15 bg-white";
  }
}

function stepLabelClass(state: StudioWorkflowTimelineStep["state"]): string {
  switch (state) {
    case "completed":
      return "text-black/75";
    case "current":
      return "font-medium text-black";
    case "failed":
      return "font-medium text-red-700";
    default:
      return "text-black/40";
  }
}

function activityToneClass(tone: StudioWorkflowActivityEntry["tone"]): string {
  switch (tone) {
    case "progress":
      return "text-black/70";
    case "issue":
      return "text-red-700";
    default:
      return "text-black/55";
  }
}

export function WorkflowProgressTimeline({
  timeline,
  activity,
}: {
  timeline: readonly StudioWorkflowTimelineStep[];
  activity: readonly StudioWorkflowActivityEntry[];
}) {
  return (
    <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div aria-label="Review progress">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-black/45">Progress</h4>
        <ol className="mt-3 space-y-0">
          {timeline.map((step, index) => (
            <li key={step.id} className="relative flex gap-3 pb-5 last:pb-0">
              {index < timeline.length - 1 ? (
                <span
                  aria-hidden
                  className={`absolute left-[7px] top-4 h-[calc(100%-0.25rem)] w-px ${
                    step.state === "completed" ? "bg-accent/50" : "bg-black/10"
                  }`}
                />
              ) : null}
              <span
                aria-hidden
                className={`relative z-[1] mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${stepDotClass(step.state)}`}
              />
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${stepLabelClass(step.state)}`}>{step.label}</p>
                {step.timestamp ? (
                  <p className="mt-0.5 text-xs text-black/40">{fmtWhen(step.timestamp)}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div aria-label="Recent activity">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-black/45">Recent activity</h4>
        {activity.length === 0 ? (
          <p className="mt-3 text-sm text-black/45">Waiting for the first workflow update…</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {activity.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 text-sm">
                <span className={activityToneClass(entry.tone)}>{entry.label}</span>
                <time className="shrink-0 text-xs text-black/40">{fmtWhen(entry.timestamp)}</time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
