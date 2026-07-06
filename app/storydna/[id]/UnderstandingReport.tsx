// StoryDNA Understanding Report — UI ONLY (static placeholders).
// No backend, no database, no AI, no wired-up functionality. Every value below
// is a placeholder marked clearly as temporary. Matches the StoryDNA card style.

const THEMES = ["Justice", "Redemption", "Family", "Faith"];

const EMOTIONAL_PROMISE = ["Beginning", "Middle", "Ending", "After Finishing"];

const CONFIDENCE = [
  { label: "Story Understanding", value: 98 },
  { label: "Theme Understanding", value: 94 },
  { label: "Character Understanding", value: 97 },
  { label: "Message Understanding", value: 90 },
];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/45">
      {children}
    </p>
  );
}

/** A clearly-temporary placeholder block (dashed + italic so it reads as WIP). */
function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-black/20 bg-white/40 p-4 text-sm italic leading-relaxed text-black/50 dark:border-white/20 dark:bg-white/[.03] dark:text-white/50">
      {children}
    </div>
  );
}

export default function UnderstandingReport() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/[.07] via-paper to-paper p-6 shadow-md dark:from-accent/[.12] dark:via-white/5 dark:to-white/5">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-accent" aria-hidden>
              ✦
            </span>
            <h2 className="font-serif text-xl font-semibold tracking-tight">
              Here’s the story I believe you wrote.
            </h2>
          </div>
          <span className="rounded-full border border-dashed border-black/20 px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40 dark:border-white/25 dark:text-white/40">
            Placeholder preview
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/55 dark:text-white/55">
          Before I review your manuscript, I want to make sure I understand the story you’re trying
          to tell.
        </p>
      </div>

      <div className="space-y-6">
        {/* Story Summary */}
        <section>
          <SectionHeading>Story Summary</SectionHeading>
          <Placeholder>
            [ Placeholder — a short 2–3 sentence summary of the story will appear here once
            StoryDNA generates it. This text is temporary. ]
          </Placeholder>
        </section>

        {/* Primary Themes */}
        <section className="border-t border-black/5 pt-5 dark:border-white/10">
          <SectionHeading>Primary Themes</SectionHeading>
          <div className="flex flex-wrap gap-2">
            {THEMES.map((theme) => (
              <span
                key={theme}
                className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-sm font-medium text-accent"
              >
                {theme}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs italic text-black/40 dark:text-white/40">
            [ placeholder badges ]
          </p>
        </section>

        {/* StoryDNA Believes Your Story Is About */}
        <section className="border-t border-black/5 pt-5 dark:border-white/10">
          <SectionHeading>StoryDNA Believes Your Story Is About</SectionHeading>
          <Placeholder>
            [ Placeholder — StoryDNA’s interpretation of what the story is really about will appear
            here. This text is temporary. ]
          </Placeholder>
        </section>

        {/* Emotional Promise */}
        <section className="border-t border-black/5 pt-5 dark:border-white/10">
          <SectionHeading>Emotional Promise</SectionHeading>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {EMOTIONAL_PROMISE.map((stage) => (
              <div
                key={stage}
                className="rounded-xl border border-dashed border-black/20 bg-white/40 p-3 dark:border-white/20 dark:bg-white/[.03]"
              >
                <p className="text-xs font-semibold text-black/70 dark:text-white/70">{stage}</p>
                <p className="mt-1 text-xs italic text-black/45 dark:text-white/45">
                  [ placeholder ]
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* StoryDNA Confidence */}
        <section className="border-t border-black/5 pt-5 dark:border-white/10">
          <SectionHeading>StoryDNA Confidence</SectionHeading>
          <div className="space-y-3">
            {CONFIDENCE.map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between text-xs text-black/60 dark:text-white/60">
                  <span>{row.label}</span>
                  <span className="font-semibold tabular-nums text-accent">{row.value}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${row.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs italic text-black/40 dark:text-white/40">
            [ placeholder confidence values ]
          </p>
        </section>

        {/* Bottom question */}
        <section className="border-t border-black/5 pt-5 text-center dark:border-white/10">
          <p className="text-base font-medium">Did StoryDNA understand your story?</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {["Yes", "Mostly", "No"].map((label) => (
              <button
                key={label}
                type="button"
                className="rounded-xl border border-black/15 px-6 py-2.5 text-sm font-semibold uppercase tracking-wide transition hover:border-accent/50 hover:bg-accent/5 dark:border-white/20"
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs italic text-black/40 dark:text-white/40">
            [ placeholder — buttons are not wired up yet ]
          </p>
        </section>
      </div>
    </div>
  );
}
