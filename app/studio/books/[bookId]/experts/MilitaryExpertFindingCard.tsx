import type { MilitaryExpertFindingDisplayItem } from "@/lib/studio/military-expert-finding-display.ts";

function EvidenceBlock({ evidence }: { evidence: MilitaryExpertFindingDisplayItem["supportingEvidence"] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
        {evidence.heading}
      </p>
      {evidence.items.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {evidence.items.map((item, index) => (
            <li
              key={`${item.location ?? "item"}-${index}`}
              className="rounded-md border border-black/10 bg-black/[0.02] p-3 text-sm dark:border-white/10 dark:bg-white/[0.03]"
            >
              {item.location ? (
                <p className="text-xs font-medium text-black/55 dark:text-white/55">{item.location}</p>
              ) : null}
              <p className="mt-1 text-black/75 dark:text-white/75">{item.excerpt}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-black/65 dark:text-white/65">{evidence.summary}</p>
      )}
      {evidence.items.length > 0 && evidence.summary.includes("excerpts recorded") ? (
        <p className="mt-2 text-xs text-black/55 dark:text-white/55">{evidence.summary}</p>
      ) : null}
    </div>
  );
}

export function MilitaryExpertConfirmedFindingCard({
  item,
}: {
  item: MilitaryExpertFindingDisplayItem;
}) {
  return (
    <li className="rounded-lg border border-black/10 p-4 text-sm dark:border-white/10">
      <p className="text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
        {item.statusLabel}
      </p>
      <h4 className="mt-2 text-base font-medium">{item.title}</h4>
      <dl className="mt-2 grid gap-1 text-xs text-black/60 dark:text-white/60 sm:grid-cols-2">
        <div>
          <dt className="inline font-medium">Severity: </dt>
          <dd className="inline">{item.severity.replace(/_/g, " ")}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Confidence: </dt>
          <dd className="inline">{item.confidence}</dd>
        </div>
      </dl>
      <div className="mt-3 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            What StoryDNA found
          </p>
          <p className="mt-1 text-black/75 dark:text-white/75">{item.concern}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Why it matters
          </p>
          <p className="mt-1 text-black/75 dark:text-white/75">{item.whyItMatters}</p>
        </div>
        <EvidenceBlock evidence={item.supportingEvidence} />
        {item.contraryEvidence ? <EvidenceBlock evidence={item.contraryEvidence} /> : null}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Recommended action
          </p>
          <p className="mt-1 text-black/75 dark:text-white/75">{item.recommendedAction}</p>
        </div>
      </div>
    </li>
  );
}

export function MilitaryExpertAuthorReviewFindingCard({
  item,
}: {
  item: MilitaryExpertFindingDisplayItem;
}) {
  return (
    <li className="rounded-lg border border-amber-200/80 bg-white/80 p-4 dark:border-amber-500/20 dark:bg-black/20">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
        {item.statusLabel}
      </p>
      <h4 className="mt-2 text-base font-medium text-slate-900 dark:text-slate-100">{item.title}</h4>
      <div className="mt-3 space-y-3 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/80 dark:text-amber-200/80">
            What StoryDNA found
          </p>
          <p className="mt-1 text-slate-700 dark:text-slate-300">{item.concern}</p>
        </div>
        <EvidenceBlock evidence={item.supportingEvidence} />
        {item.couldNotVerify.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/80 dark:text-amber-200/80">
              What StoryDNA could not verify
            </p>
            <ul className="mt-1 list-disc pl-5 text-slate-600 dark:text-slate-400">
              {item.couldNotVerify.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/80 dark:text-amber-200/80">
            Uncertainty
          </p>
          <p className="mt-1 text-slate-700 dark:text-slate-300">{item.uncertaintyExplanation}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/80 dark:text-amber-200/80">
            Recommended action
          </p>
          <p className="mt-1 font-medium text-slate-800 dark:text-slate-200">{item.recommendedAction}</p>
        </div>
      </div>
    </li>
  );
}
