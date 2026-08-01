import type { EditorialProfilePresentationState } from "@/lib/studio/editorial-profile-presentation.ts";

type Props = {
  state: EditorialProfilePresentationState;
  message: string;
  manuscriptTitle: string;
  versionLabel: string | null;
};

const STATE_HEADINGS: Partial<Record<EditorialProfilePresentationState, string>> = {
  feature_disabled: "Editorial Profile unavailable",
  no_active_profile: "No Editorial Profile yet",
  profile_being_prepared: "Profile being prepared",
  incomplete_evidence: "More coverage needed",
  awaiting_eic_confirmation: "Awaiting confirmation",
  blocked: "Profile temporarily unavailable",
  generation_failed: "Profile could not be completed",
  read_model_validation_failed: "Profile could not be displayed",
  loading: "Loading Editorial Profile",
};

export function EditorialProfileStateView({ state, message, manuscriptTitle, versionLabel }: Props) {
  const heading = STATE_HEADINGS[state] ?? "Editorial Profile";

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-xl border border-black/10 bg-paper px-8 py-10 dark:border-white/10"
    >
      <p className="text-xs font-medium uppercase tracking-widest text-accent">Editor-in-Chief</p>
      <h1 className="mt-2 font-serif text-2xl font-semibold tracking-tight">{heading}</h1>
      <p className="mt-1 text-sm text-black/55 dark:text-white/55">{manuscriptTitle}</p>
      {versionLabel ? (
        <p className="text-sm text-black/45 dark:text-white/45">Version {versionLabel}</p>
      ) : null}
      <p className="mt-6 max-w-2xl text-[0.9375rem] leading-relaxed text-black/70 dark:text-white/70">
        {message}
      </p>
    </div>
  );
}
