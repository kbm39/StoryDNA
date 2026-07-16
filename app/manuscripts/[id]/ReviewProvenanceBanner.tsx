import type { AuthoritativeReviewDisplay } from "@/lib/authoritative-review-display";
import { provenanceLinesForDisplay } from "@/lib/review-provenance";

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "active" | "superseded" | "warn" | "danger" | "muted";
}) {
  const cls =
    tone === "active"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
      : tone === "superseded"
        ? "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white/70"
        : tone === "warn"
          ? "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200"
          : tone === "danger"
            ? "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300"
            : "bg-black/5 text-black/55 dark:bg-white/10 dark:text-white/55";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${cls}`}>
      {label}
    </span>
  );
}

function badgeTone(label: string): "active" | "superseded" | "warn" | "danger" | "muted" {
  if (label === "Active") return "active";
  if (label === "Superseded") return "superseded";
  if (label === "Pre-enforcement") return "warn";
  if (label === "Contradicts canonical statistics") return "danger";
  return "muted";
}

export function ReviewProvenanceBanner({
  display,
  manuscriptPagePath,
}: {
  display: AuthoritativeReviewDisplay;
  manuscriptPagePath?: string;
}) {
  const { provenance } = display;
  const lines = provenanceLinesForDisplay(provenance);

  return (
    <div className="mb-4 rounded-lg border border-black/10 bg-black/[.02] p-3 dark:border-white/10 dark:bg-white/[.03]">
      {!provenance.is_authoritative_active && manuscriptPagePath && (
        <p className="mb-2 text-xs">
          <a href={manuscriptPagePath} className="font-medium text-accent hover:underline">
            ← Return to authoritative review
          </a>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
          Review provenance
        </p>
        {provenance.is_authoritative_active && (
          <StatusBadge label="Authoritative" tone="active" />
        )}
        {provenance.status_labels.map((label) => (
          <StatusBadge key={label} label={label} tone={badgeTone(label)} />
        ))}
      </div>
      <dl className="mt-2 grid gap-1 text-xs text-black/70 dark:text-white/70 sm:grid-cols-2">
        {lines.map((line) => {
          const [key, ...rest] = line.split(": ");
          const value = rest.join(": ");
          if (!value) {
            return (
              <div key={line} className="sm:col-span-2">
                <p
                  className={
                    line === provenance.historical_disclaimer
                      ? "font-medium text-amber-900 dark:text-amber-200"
                      : "italic text-amber-800/90 dark:text-amber-200/90"
                  }
                >
                  {line}
                </p>
              </div>
            );
          }
          return (
            <div key={line}>
              <dt className="inline font-medium text-black/50 dark:text-white/50">{key}: </dt>
              <dd className="inline font-mono text-[11px]">{value}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
