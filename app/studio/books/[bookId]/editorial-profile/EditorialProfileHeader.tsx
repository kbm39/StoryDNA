import type { StudioEditorialProfilePresentation } from "@/lib/studio/editorial-profile-presentation.ts";

type Props = {
  manuscriptTitle: string;
  versionLabel: string | null;
  statusLabel: string;
  lastUpdatedLabel: string | null;
  headerExplanation: string;
};

export function EditorialProfileHeader({
  manuscriptTitle,
  versionLabel,
  statusLabel,
  lastUpdatedLabel,
  headerExplanation,
}: Props) {
  return (
    <header className="space-y-4 border-b border-black/10 pb-6 dark:border-white/10">
      <p className="text-xs font-medium uppercase tracking-widest text-accent">Editor-in-Chief</p>
      <div className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Editorial Profile</h1>
        <p className="text-sm text-black/60 dark:text-white/60">{manuscriptTitle}</p>
        {versionLabel ? (
          <p className="text-sm text-black/50 dark:text-white/50">Version {versionLabel}</p>
        ) : null}
      </div>
      <p className="max-w-3xl text-[0.9375rem] leading-relaxed text-black/70 dark:text-white/70">
        {headerExplanation}
      </p>
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="text-black/45 dark:text-white/45">Status</dt>
          <dd>{statusLabel}</dd>
        </div>
        {lastUpdatedLabel ? (
          <div>
            <dt className="text-black/45 dark:text-white/45">Last updated</dt>
            <dd>{lastUpdatedLabel}</dd>
          </div>
        ) : null}
      </dl>
    </header>
  );
}

export function EditorialProfileHeaderFromPresentation({
  presentation,
}: {
  presentation: StudioEditorialProfilePresentation;
}) {
  return (
    <EditorialProfileHeader
      manuscriptTitle={presentation.manuscriptTitle}
      versionLabel={presentation.versionLabel}
      statusLabel={presentation.statusLabel}
      lastUpdatedLabel={presentation.lastUpdatedLabel}
      headerExplanation={presentation.headerExplanation}
    />
  );
}
