import type { AuthorFacingConfidenceLevel } from "@/lib/editorial-profile/author-facing-contract.ts";
import type { AuthorFacingEvidenceReference } from "@/lib/editorial-profile/author-facing-types.ts";

export function confidenceTone(level: AuthorFacingConfidenceLevel): string {
  switch (level) {
    case "high":
      return "text-black/70 dark:text-white/70";
    case "moderate":
      return "text-black/60 dark:text-white/60";
    case "limited":
      return "text-black/50 dark:text-white/50 italic";
    case "insufficient_evidence":
      return "text-black/45 dark:text-white/45 italic";
    default:
      return "text-black/55 dark:text-white/55";
  }
}

export function EvidenceList({ items }: { items: readonly AuthorFacingEvidenceReference[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-3 space-y-2 border-l-2 border-black/10 pl-4 dark:border-white/10">
      {items.map((evidence) => (
        <li key={evidence.evidence_id} className="text-sm">
          <p className="font-medium text-black/75 dark:text-white/75">{evidence.locator_label}</p>
          <p className="mt-0.5 text-black/60 dark:text-white/60">{evidence.observation}</p>
          {evidence.excerpt ? (
            <blockquote className="mt-1 border-l border-black/15 pl-3 text-black/55 italic dark:border-white/15 dark:text-white/55">
              {evidence.excerpt}
            </blockquote>
          ) : null}
          {evidence.has_contrary_signal ? (
            <p className="mt-1 text-xs text-black/50 dark:text-white/50">
              Conflicting signals noted in the independent read.
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function UncertaintyNotes({ notes }: { notes: readonly string[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 text-sm text-black/55 dark:text-white/55">
      {notes.map((note) => (
        <li key={note}>{note}</li>
      ))}
    </ul>
  );
}

export function SectionShell({
  id,
  title,
  children,
  className = "",
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={`scroll-mt-6 space-y-4 ${className}`}
    >
      <h2 id={`${id}-heading`} className="font-serif text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}
