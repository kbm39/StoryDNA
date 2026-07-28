"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import type {
  StudioEditorialHealth,
  StudioEditorialTeamMember,
  StudioReviewExecutionView,
  StudioRoundtableShell,
} from "@/lib/studio/types.ts";
import type { StudioLaunchScope } from "@/lib/studio/types.ts";
import {
  cancelStudioReview,
  launchStudioEditorialRound,
  launchStudioExpertReview,
  recruitStudioExpert,
  removeStudioExpert,
  saveStudioExpertNotes,
} from "@/app/studio/actions/expert-execution.ts";
import { STUDIO_MILITARY_EXPERT_LAUNCH_ACK } from "@/lib/studio/military-expert-local-policy.ts";
import {
  computeLaunchWizardCanLaunch,
  launchWizardNeedsPrivateUseAck,
} from "@/lib/studio/launch-wizard-state.ts";

function isMilitaryExpertMember(member: StudioEditorialTeamMember): boolean {
  return member.expertKey === "military_expert";
}

function isMilitaryLocalTestingEnabled(member: StudioEditorialTeamMember): boolean {
  return isMilitaryExpertMember(member) && member.tierLabel === "Experimental — Private Local Testing";
}

function isMilitaryBlockedInStudio(member: StudioEditorialTeamMember): boolean {
  return isMilitaryExpertMember(member) && !isMilitaryLocalTestingEnabled(member);
}

function recruitDisabled(
  member: StudioEditorialTeamMember,
  pending: boolean,
  privateUseAcknowledged: boolean,
): boolean {
  if (pending) return true;
  if (member.executionClass === "PLACEHOLDER") return true;
  if (isMilitaryBlockedInStudio(member)) return true;
  if (isMilitaryLocalTestingEnabled(member) && !privateUseAcknowledged) return true;
  return false;
}

function runStatusLabel(status: StudioEditorialTeamMember["runStatus"]): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "waiting":
      return "Waiting";
    case "blocked":
      return "Blocked";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
  }
}

function LaunchWizard({
  bookId,
  member,
  bookTitle,
  wordCount,
  versionLabel,
  acknowledged,
  onClose,
}: {
  bookId: string;
  member: StudioEditorialTeamMember;
  bookTitle: string;
  wordCount: number | null;
  versionLabel: string | null;
  acknowledged: boolean;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [scope, setScope] = useState<StudioLaunchScope>("full_book");
  const needsExperimentalAck = member.policy.studioStatus === "experimental";
  const isMilitaryLaunch = isMilitaryExpertMember(member);
  const memberContext = { isMilitaryLaunch, needsExperimentalAck };
  const needsPrivateUseAck = launchWizardNeedsPrivateUseAck(memberContext);
  const [privateUseAck, setPrivateUseAck] = useState(acknowledged);
  const [experimentalAck, setExperimentalAck] = useState(false);
  const [militaryLaunchAckToken, setMilitaryLaunchAckToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (acknowledged) setPrivateUseAck(true);
  }, [acknowledged]);

  const canLaunch = computeLaunchWizardCanLaunch(memberContext, {
    privateUseAck: needsPrivateUseAck ? privateUseAck : acknowledged,
    experimentalAck,
    militaryLaunchAckToken,
  });
  const privateUseConfirmed = needsPrivateUseAck
    ? privateUseAck && (!needsExperimentalAck || experimentalAck)
    : acknowledged;

  function launch() {
    setError(null);
    start(async () => {
      const result = await launchStudioExpertReview({
        manuscriptId: bookId,
        expertKey: member.expertKey,
        scope,
        privateUseAcknowledged: privateUseConfirmed,
        militaryLaunchAckToken: isMilitaryLaunch ? militaryLaunchAckToken : undefined,
      });
      if (!result.ok) {
        setError(result.error ?? "Unable to launch review.");
        return;
      }
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="launch-wizard-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-paper p-6 shadow-xl">
        <h3 id="launch-wizard-title" className="font-serif text-xl font-semibold">
          Launch Review — {member.displayName}
        </h3>

        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="font-medium text-black/50">Book</dt>
            <dd>{bookTitle}</dd>
          </div>
          <div>
            <dt className="font-medium text-black/50">Version</dt>
            <dd>{versionLabel ?? "Current"}</dd>
          </div>
          <div>
            <dt className="font-medium text-black/50">Word count</dt>
            <dd>{wordCount?.toLocaleString() ?? "Unavailable"}</dd>
          </div>
          <div>
            <dt className="font-medium text-black/50">Expert</dt>
            <dd>{member.displayName}</dd>
          </div>
          <div>
            <dt className="font-medium text-black/50">Estimated runtime</dt>
            <dd>{member.expectedRuntime}</dd>
          </div>
          <div>
            <dt className="font-medium text-black/50">Estimated cost</dt>
            <dd>{member.estimatedCost ?? "Unavailable"}</dd>
          </div>
          <div>
            <dt className="font-medium text-black/50">Expected output</dt>
            <dd>
              {isMilitaryLaunch
                ? "Military tactical realism review — command, rank, tactics, logistics, and operational accuracy (not a Literary Agent commercial review)."
                : "Commercial review, editorial issues, and revision candidates"}
            </dd>
          </div>
        </dl>

        {isMilitaryLaunch ? (
          <div
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-950"
            role="alert"
          >
            <p className="font-semibold">Uncertified — local development only (paid API call)</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
              <li>Military Expert is not commercially certified and remains disabled in production.</li>
              <li>This launch runs only in local Kevin Studio with an explicit developer override.</li>
              <li>A real Anthropic provider call will be made — you may incur API cost.</li>
              <li>Output is a draft military tactical review, not Literary Agent commercial output.</li>
            </ul>
          </div>
        ) : null}

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Scope</legend>
          <div className="mt-2 space-y-1 text-sm">
            {(
              [
                ["full_book", "Full Book"],
                ["selected_chapters", "Selected Chapters"],
                ["excerpt", "Excerpt"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="scope"
                  value={value}
                  checked={scope === value}
                  onChange={() => setScope(value)}
                  disabled={value !== "full_book"}
                />
                {label}
                {value !== "full_book" ? (
                  <span className="text-xs text-black/45">(coming soon)</span>
                ) : null}
              </label>
            ))}
          </div>
        </fieldset>

        {needsPrivateUseAck ? (
          <label className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
            <input
              type="checkbox"
              checked={privateUseAck}
              onChange={(e) => setPrivateUseAck(e.target.checked)}
              className="mt-1"
            />
            <span>
              I understand experimental and advisory experts are for private Kevin Track use only.
              They are not commercially certified and do not alter StoryDNA production controls.
            </span>
          </label>
        ) : null}

        {needsExperimentalAck ? (
          <label className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
            <input
              type="checkbox"
              checked={experimentalAck}
              onChange={(e) => setExperimentalAck(e.target.checked)}
              className="mt-1"
            />
            I understand this expert is experimental and advisory.
          </label>
        ) : null}

        {isMilitaryLaunch ? (
          <label className="mt-4 block text-sm">
            <span className="font-medium">
              Type{" "}
              <code className="rounded bg-black/[0.06] px-1 py-0.5 font-mono text-xs">
                {STUDIO_MILITARY_EXPERT_LAUNCH_ACK}
              </code>{" "}
              to confirm launch
            </span>
            <input
              type="text"
              value={militaryLaunchAckToken}
              onChange={(e) => setMilitaryLaunchAckToken(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="mt-2 w-full rounded-lg border border-black/10 p-2 font-mono text-xs"
              placeholder="Confirmation token required"
            />
          </label>
        ) : null}

        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || !canLaunch}
            onClick={launch}
            className="rounded-lg bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Launch Review
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="rounded-lg border border-black/10 px-4 py-2 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewDashboard({
  bookId,
  workflow,
  onCancel,
}: {
  bookId: string;
  workflow: StudioReviewExecutionView;
  onCancel: () => void;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function cancel() {
    start(async () => {
      const result = await cancelStudioReview({
        manuscriptId: bookId,
        workflowId: workflow.workflowId,
      });
      setMessage(result.ok ? "Cancellation requested." : result.error ?? "Unable to cancel.");
      if (result.ok) onCancel();
    });
  }

  return (
    <section className="rounded-xl border border-accent/30 bg-accent/5 p-5" aria-labelledby="review-dashboard">
      <h3 id="review-dashboard" className="font-serif text-lg font-semibold">
        Live Review — {workflow.expertDisplayName}
      </h3>
      <div className="mt-3 flex flex-wrap gap-3">
        <span className="rounded-full border border-black/15 px-2 py-0.5 text-xs font-medium">
          {workflow.statusLabel}
        </span>
        <span className="text-xs text-black/55">Elapsed: {workflow.elapsed}</span>
      </div>
      <p className="mt-2 text-sm">{workflow.progressSummary ?? workflow.currentPhaseLabel}</p>
      {workflow.safeErrorMessage ? (
        <p className="mt-2 text-sm text-red-700">{workflow.safeErrorMessage}</p>
      ) : null}
      <dl className="mt-3 grid gap-1 text-xs text-black/55 sm:grid-cols-2">
        <div>
          <dt className="inline font-medium">Start: </dt>
          <dd className="inline">
            {workflow.startedAt ? new Date(workflow.startedAt).toLocaleString() : "—"}
          </dd>
        </div>
        <div>
          <dt className="inline font-medium">Phase: </dt>
          <dd className="inline">{workflow.currentPhaseLabel}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Estimated cost: </dt>
          <dd className="inline">{workflow.cost.estimatedCost}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Actual cost: </dt>
          <dd className="inline">{workflow.cost.actualCost ?? "Unavailable"}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Tokens: </dt>
          <dd className="inline">{workflow.cost.tokens ?? "Unavailable"}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Model: </dt>
          <dd className="inline">{workflow.cost.model}</dd>
        </div>
      </dl>
      {!workflow.isTerminal ? (
        <button
          type="button"
          disabled={pending}
          onClick={cancel}
          className="mt-4 rounded-lg border border-black/10 px-3 py-2 text-sm disabled:opacity-50"
        >
          Cancel Review
        </button>
      ) : null}
      {message ? <p className="mt-2 text-xs text-black/55">{message}</p> : null}
    </section>
  );
}

function RoundtableShell({ roundtable }: { roundtable: StudioRoundtableShell }) {
  return (
    <section className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-5 dark:border-indigo-900 dark:bg-indigo-950/20">
      <h3 className="font-serif text-lg font-semibold uppercase tracking-wide">{roundtable.title}</h3>
      <p className="mt-1 text-sm text-black/55">{roundtable.subtitle}</p>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <h4 className="font-medium">Agreement</h4>
          <p className="mt-1 text-black/65">{roundtable.agreement}</p>
        </div>
        <div>
          <h4 className="font-medium">Disagreement</h4>
          <p className="mt-1 text-black/65">{roundtable.disagreement}</p>
        </div>
        <div>
          <h4 className="font-medium">Priority</h4>
          <p className="mt-1 text-black/65">{roundtable.priority}</p>
        </div>
        <div>
          <h4 className="font-medium">Consensus</h4>
          <p className="mt-1 text-black/65">{roundtable.consensus}</p>
        </div>
      </div>
      <div className="mt-4">
        <h4 className="font-medium text-sm">Recommended order</h4>
        <ol className="mt-1 list-decimal pl-5 text-sm text-black/65">
          {roundtable.recommendedOrder.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function TeamMemberCard({
  bookId,
  member,
  isRecruited,
  acknowledged,
  bookTitle,
  wordCount,
  versionLabel,
  onMutate,
}: {
  bookId: string;
  member: StudioEditorialTeamMember;
  isRecruited: boolean;
  acknowledged: boolean;
  bookTitle: string;
  wordCount: number | null;
  versionLabel: string | null;
  onMutate: () => void;
}) {
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState(member.ownerNotes ?? "");
  const [showLaunch, setShowLaunch] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Action failed.");
      else onMutate();
    });
  }

  return (
    <article className="rounded-xl border border-black/10 bg-paper p-4 shadow-sm dark:border-white/10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="font-serif text-lg font-semibold">{member.displayName}</h4>
        <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-xs font-medium">
          {runStatusLabel(member.runStatus)}
        </span>
      </div>
      <p className="mt-1 text-sm text-black/65">{member.purpose}</p>
      <dl className="mt-3 grid gap-1 text-xs text-black/55">
        <div>
          <dt className="inline font-medium">Status: </dt>
          <dd className="inline">{member.policy.studioStatus}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Certification: </dt>
          <dd className="inline">{member.certificationStatus ?? "—"}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Runtime: </dt>
          <dd className="inline">{member.expectedRuntime}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Cost: </dt>
          <dd className="inline">{member.estimatedCost ?? "Unavailable"}</dd>
        </div>
        {member.lastReviewAt ? (
          <div>
            <dt className="inline font-medium">Last review: </dt>
            <dd className="inline">{new Date(member.lastReviewAt).toLocaleDateString()}</dd>
          </div>
        ) : null}
      </dl>

      {isRecruited ? (
        <label className="mt-3 block text-xs">
          <span className="font-medium">Owner notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-black/10 p-2 text-sm"
          />
        </label>
      ) : null}

      {isMilitaryBlockedInStudio(member) ? (
        <p className="mt-3 rounded-lg border border-black/10 bg-black/[0.02] p-3 text-xs text-black/65">
          Military Expert is blocked in this environment. Local testing requires{" "}
          <code className="font-mono">STUDIO_MILITARY_EXPERT_ENABLED=1</code> in development only.
        </p>
      ) : null}

      {isMilitaryLocalTestingEnabled(member) ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          {member.tierLabel} — uncertified draft expert for Kevin Studio only. Not commercially
          certified.
        </p>
      ) : null}

      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {!isRecruited ? (
          <button
            type="button"
            disabled={recruitDisabled(member, pending, acknowledged)}
            onClick={() => run(() => recruitStudioExpert({ manuscriptId: bookId, expertKey: member.expertKey }))}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm hover:border-accent disabled:opacity-50"
          >
            Recruit
          </button>
        ) : (
          <>
            {member.expertKey !== "literary_agent" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => removeStudioExpert({ manuscriptId: bookId, expertKey: member.expertKey }))}
                className="rounded-lg border border-black/10 px-3 py-2 text-sm disabled:opacity-50"
              >
                Remove
              </button>
            ) : null}
            {member.policy.launchable ? (
              <button
                type="button"
                disabled={pending || member.runStatus === "running" || member.runStatus === "queued"}
                onClick={() => setShowLaunch(true)}
                className="rounded-lg bg-accent px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                Run Review
              </button>
            ) : null}
            {member.latestReviewId ? (
              <Link
                href={`/manuscripts/${bookId}`}
                className="rounded-lg border border-black/10 px-3 py-2 text-sm hover:border-accent"
              >
                Open Latest Review
              </Link>
            ) : null}
            <Link
              href={`/studio/books/${bookId}/revisions`}
              className="rounded-lg border border-black/10 px-3 py-2 text-sm hover:border-accent"
            >
              Continue Working
            </Link>
            <button
              type="button"
              disabled={pending || !notes.trim()}
              onClick={() =>
                run(() =>
                  saveStudioExpertNotes({
                    manuscriptId: bookId,
                    expertKey: member.expertKey,
                    ownerNotes: notes,
                  }),
                )
              }
              className="rounded-lg border border-black/10 px-3 py-2 text-sm disabled:opacity-50"
            >
              Save Notes
            </button>
          </>
        )}
      </div>

      {showLaunch ? (
        <LaunchWizard
          bookId={bookId}
          member={member}
          bookTitle={bookTitle}
          wordCount={wordCount}
          versionLabel={versionLabel}
          acknowledged={acknowledged}
          onClose={() => setShowLaunch(false)}
        />
      ) : null}
    </article>
  );
}

export function EditorialTeamClient({
  bookId,
  bookTitle,
  wordCount,
  versionLabel,
  team,
  availableExperts,
  activeWorkflow,
  roundtable,
  editorialHealth,
}: {
  bookId: string;
  bookTitle: string;
  wordCount: number | null;
  versionLabel: string | null;
  team: readonly StudioEditorialTeamMember[];
  availableExperts: readonly StudioEditorialTeamMember[];
  activeWorkflow: StudioReviewExecutionView | null;
  roundtable: StudioRoundtableShell | null;
  editorialHealth: StudioEditorialHealth;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, start] = useTransition();
  const [roundError, setRoundError] = useState<string | null>(null);

  const recruitedKeys = useMemo(() => new Set(team.map((m) => m.expertKey)), [team]);

  function startRound() {
    setRoundError(null);
    start(async () => {
      const result = await launchStudioEditorialRound({
        manuscriptId: bookId,
        expertKeys: team.map((m) => m.expertKey),
        scope: "full_book",
        privateUseAcknowledged: acknowledged,
      });
      if (!result.ok) setRoundError(result.error ?? "Unable to start editorial round.");
    });
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-1"
          />
          <span>
            I understand experimental and advisory experts are for private Kevin Track use only.
            They are not commercially certified and do not alter StoryDNA production controls.
          </span>
        </label>
      </div>

      {activeWorkflow ? (
        <ReviewDashboard bookId={bookId} workflow={activeWorkflow} onCancel={() => window.location.reload()} />
      ) : null}

      <section aria-labelledby="editorial-team-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="editorial-team-heading" className="font-serif text-xl font-semibold">
              Editorial Team
            </h3>
            <p className="text-sm text-black/55">
              Experts attached to this manuscript until removed.
            </p>
          </div>
          <button
            type="button"
            disabled={pending || team.length === 0}
            onClick={startRound}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Start Editorial Round
          </button>
        </div>
        {roundError ? <p className="mt-2 text-sm text-red-700">{roundError}</p> : null}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {team.map((member) => (
            <TeamMemberCard
              key={member.expertKey}
              bookId={bookId}
              member={member}
              isRecruited
              acknowledged={acknowledged}
              bookTitle={bookTitle}
              wordCount={wordCount}
              versionLabel={versionLabel}
              onMutate={() => window.location.reload()}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="recruit-heading">
        <h3 id="recruit-heading" className="font-serif text-xl font-semibold">
          Recruit Expert
        </h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {availableExperts
            .filter((e) => !recruitedKeys.has(e.expertKey))
            .map((member) => (
              <TeamMemberCard
                key={member.expertKey}
                bookId={bookId}
                member={member}
                isRecruited={false}
                acknowledged={acknowledged}
                bookTitle={bookTitle}
                wordCount={wordCount}
                versionLabel={versionLabel}
                onMutate={() => window.location.reload()}
              />
            ))}
        </div>
      </section>

      <section className="rounded-xl border border-black/10 bg-paper p-5 dark:border-white/10">
        <h3 className="font-serif text-lg font-semibold">Editorial Health</h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
          <div>
            <dt className="text-black/50">Issues</dt>
            <dd className="font-medium">{editorialHealth.issues}</dd>
          </div>
          <div>
            <dt className="text-black/50">Resolved</dt>
            <dd className="font-medium">{editorialHealth.resolved}</dd>
          </div>
          <div>
            <dt className="text-black/50">Accepted</dt>
            <dd className="font-medium">{editorialHealth.accepted}</dd>
          </div>
          <div>
            <dt className="text-black/50">Deferred</dt>
            <dd className="font-medium">{editorialHealth.deferred}</dd>
          </div>
          <div>
            <dt className="text-black/50">Rejected</dt>
            <dd className="font-medium">{editorialHealth.rejected}</dd>
          </div>
          <div>
            <dt className="text-black/50">Open</dt>
            <dd className="font-medium">{editorialHealth.open}</dd>
          </div>
          <div>
            <dt className="text-black/50">Overall progress</dt>
            <dd className="font-medium">{editorialHealth.overallProgress}%</dd>
          </div>
        </dl>
      </section>

      {roundtable ? <RoundtableShell roundtable={roundtable} /> : null}
    </div>
  );
}
