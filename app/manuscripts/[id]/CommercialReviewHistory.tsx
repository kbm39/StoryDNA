import Link from "next/link";
import type { EditorialHistoryEntry } from "@/lib/review-provenance";

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

export function CommercialReviewHistory({
  entries,
  selectedReviewId,
}: {
  entries: EditorialHistoryEntry[];
  selectedReviewId?: string | null;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="mb-5 rounded-xl border border-black/10 bg-paper p-4 shadow-sm dark:border-white/15 dark:bg-white/5">
      <h3 className="font-serif text-base font-semibold text-emerald-800 dark:text-emerald-400">
        Editorial History
      </h3>
      <p className="mt-1 text-xs text-black/50 dark:text-white/50">
        Literary Agent commercial reviews for this manuscript. The authoritative active review is
        shown by default; open a row to view a historical assessment.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead>
            <tr className="border-b border-black/10 text-[10px] uppercase tracking-wide text-black/45 dark:border-white/10 dark:text-white/45">
              <th className="py-2 pr-3 font-semibold">Generated</th>
              <th className="py-2 pr-3 font-semibold">Status</th>
              <th className="py-2 pr-3 font-semibold">Version</th>
              <th className="py-2 pr-3 font-semibold">Canonical words</th>
              <th className="py-2 pr-3 font-semibold">Model</th>
              <th className="py-2 pr-3 font-semibold">Review ID</th>
              <th className="py-2 font-semibold">View</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const isSelected =
                selectedReviewId != null
                  ? entry.review_id === selectedReviewId
                  : entry.is_authoritative_active;
              return (
                <tr
                  key={entry.review_id}
                  className={`border-b border-black/5 dark:border-white/5 ${
                    entry.is_authoritative_active
                      ? "bg-emerald-50/60 dark:bg-emerald-500/5"
                      : isSelected
                        ? "bg-amber-50/50 dark:bg-amber-500/5"
                        : ""
                  }`}
                >
                  <td className="py-2.5 pr-3 tabular-nums">{entry.generated_at}</td>
                  <td className="py-2.5 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {entry.is_authoritative_active && (
                        <StatusBadge label="Authoritative" tone="active" />
                      )}
                      {entry.status_labels.map((label) => (
                        <StatusBadge key={label} label={label} tone={badgeTone(label)} />
                      ))}
                    </div>
                    {entry.warnings.length > 0 && (
                      <p className="mt-1 max-w-xs text-[10px] leading-snug text-amber-800 dark:text-amber-200/90">
                        {entry.warnings[0]}
                      </p>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-[11px]">
                    {entry.manuscript_version_label}
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums">
                    {entry.canonical_word_count != null
                      ? entry.canonical_word_count.toLocaleString()
                      : "—"}
                  </td>
                  <td className="py-2.5 pr-3">{entry.model}</td>
                  <td className="py-2.5 pr-3 font-mono text-[10px]">{entry.review_id}</td>
                  <td className="py-2.5">
                    {entry.is_authoritative_active ? (
                      <span className="font-medium text-emerald-700 dark:text-emerald-300">
                        Current
                      </span>
                    ) : (
                      <Link
                        href={entry.view_href}
                        className="font-medium text-accent hover:underline"
                      >
                        Open
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
