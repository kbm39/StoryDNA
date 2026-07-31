"use client";

import { useState, useTransition } from "react";
import {
  AUTHOR_INTENT_TYPE_LABELS,
  AUTHOR_INTENT_TYPES,
  PRIORITY_DOMAINS,
  type AuthorIntentType,
  type PriorityDomain,
} from "@/lib/author-intent/contract.ts";
import { KNOWN_EXPERT_KEYS } from "@/lib/author-intent/expert-keys.ts";
import type { AuthorIntentRecord } from "@/lib/author-intent/types.ts";
import type { EicEditorialPlanV1 } from "@/lib/eic/contract.ts";
import {
  createAndActivateAuthorIntent,
  supersedeAuthorIntentAction,
} from "@/app/studio/actions/author-intent.ts";

const REQUIRED_COPY =
  "StoryDNA uses your goal to recommend the right editorial team. No expert will be launched from this plan without your confirmation.";

type Props = {
  bookId: string;
  bookTitle: string;
  enabled: boolean;
  eicEnabled: boolean;
  activeIntent: AuthorIntentRecord | null;
  history: readonly AuthorIntentRecord[];
  planPreview: EicEditorialPlanV1 | null;
  versionLabel: string | null;
};

function ExpertPlanList({
  title,
  experts,
}: {
  title: string;
  experts: readonly { expert_key: string; display_name: string; tier: string; reason: string }[];
}) {
  if (experts.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">{title}</h4>
      <ul className="space-y-1 text-sm">
        {experts.map((e) => (
          <li key={e.expert_key} className="rounded border border-black/10 px-3 py-2 dark:border-white/10">
            <span className="font-medium">{e.display_name}</span>
            <span className="ml-2 text-xs uppercase text-black/45 dark:text-white/45">{e.tier}</span>
            <p className="mt-1 text-black/55 dark:text-white/55">{e.reason}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AuthorIntentClient({
  bookId,
  bookTitle,
  enabled,
  eicEnabled,
  activeIntent,
  history,
  planPreview,
  versionLabel,
}: Props) {
  const [intentType, setIntentType] = useState<AuthorIntentType>(
    activeIntent?.intent_type ?? "general_manuscript_review",
  );
  const [customText, setCustomText] = useState(activeIntent?.custom_objective_text ?? "");
  const [successDef, setSuccessDef] = useState(
    activeIntent?.author_success_definition ?? "",
  );
  const [requested, setRequested] = useState<string[]>(
    activeIntent ? [...activeIntent.requested_experts] : [],
  );
  const [declined, setDeclined] = useState<string[]>(
    activeIntent ? [...activeIntent.declined_experts] : [],
  );
  const [domains, setDomains] = useState<PriorityDomain[]>(
    activeIntent ? [...activeIntent.priority_domains] : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [superseding, setSuperseding] = useState(false);

  if (!enabled) {
    return (
      <div className="rounded-lg border border-black/10 bg-paper p-6 dark:border-white/10">
        <p className="text-sm text-black/55 dark:text-white/55">
          Author Intent is not enabled. Set <code>STUDIO_AUTHOR_INTENT_ENABLED=1</code> in your local
          environment to use this feature.
        </p>
      </div>
    );
  }

  function toggleExpert(key: string, list: "requested" | "declined") {
    if (list === "requested") {
      setRequested((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
      );
      setDeclined((prev) => prev.filter((k) => k !== key));
    } else {
      setDeclined((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
      );
      setRequested((prev) => prev.filter((k) => k !== key));
    }
  }

  function toggleDomain(domain: PriorityDomain) {
    setDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain],
    );
  }

  function handleSubmit(activate: boolean) {
    setError(null);
    startTransition(async () => {
      const payload = {
        manuscriptId: bookId,
        intentType,
        customObjectiveText: intentType === "custom" ? customText : undefined,
        authorSuccessDefinition: successDef,
        requestedExperts: requested,
        declinedExperts: declined,
        priorityDomains: domains,
      };

      const result = activeIntent && superseding
        ? await supersedeAuthorIntentAction({
            ...payload,
            currentIntentId: activeIntent.id,
          })
        : await createAndActivateAuthorIntent(payload);

      if (!result.ok) {
        setError(result.error ?? "Failed to save intent");
        return;
      }
      setSuperseding(false);
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl font-semibold">What are you trying to accomplish?</h2>
        <p className="mt-1 text-sm text-black/55 dark:text-white/55">
          {bookTitle}
          {versionLabel ? ` · ${versionLabel}` : ""}
        </p>
        <p className="mt-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
          {REQUIRED_COPY}
        </p>
      </div>

      {activeIntent && !superseding && (
        <div className="rounded-lg border border-green-600/30 bg-green-600/5 p-4">
          <p className="text-sm font-medium text-green-800 dark:text-green-300">
            Active intent: {AUTHOR_INTENT_TYPE_LABELS[activeIntent.intent_type]}
          </p>
          <p className="mt-1 text-sm text-black/55 dark:text-white/55">
            {activeIntent.author_success_definition}
          </p>
          <button
            type="button"
            onClick={() => setSuperseding(true)}
            className="mt-3 text-sm text-accent hover:underline"
          >
            Supersede this intent
          </button>
        </div>
      )}

      {(superseding || !activeIntent) && (
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(true);
          }}
        >
          <div>
            <label htmlFor="intent-type" className="block text-sm font-medium">
              Primary intent
            </label>
            <select
              id="intent-type"
              value={intentType}
              onChange={(e) => setIntentType(e.target.value as AuthorIntentType)}
              className="mt-1 w-full rounded-lg border border-black/10 bg-paper px-3 py-2 text-sm dark:border-white/10"
            >
              {AUTHOR_INTENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {AUTHOR_INTENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {intentType === "custom" && (
            <div>
              <label htmlFor="custom-text" className="block text-sm font-medium">
                Custom objective
              </label>
              <textarea
                id="custom-text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-black/10 bg-paper px-3 py-2 text-sm dark:border-white/10"
                required
              />
            </div>
          )}

          <div>
            <label htmlFor="success-def" className="block text-sm font-medium">
              What does success look like?
            </label>
            <textarea
              id="success-def"
              value={successDef}
              onChange={(e) => setSuccessDef(e.target.value)}
              rows={3}
              required
              className="mt-1 w-full rounded-lg border border-black/10 bg-paper px-3 py-2 text-sm dark:border-white/10"
            />
          </div>

          <div>
            <p className="text-sm font-medium">Priority domains</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRIORITY_DOMAINS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDomain(d)}
                  className={`rounded-full px-3 py-1 text-xs ${
                    domains.includes(d)
                      ? "bg-accent text-white"
                      : "border border-black/10 dark:border-white/10"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium">Request experts</p>
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
                {KNOWN_EXPERT_KEYS.map((key) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={requested.includes(key)}
                      onChange={() => toggleExpert(key, "requested")}
                    />
                    {key.replace(/_/g, " ")}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">Decline experts</p>
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
                {KNOWN_EXPERT_KEYS.map((key) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={declined.includes(key)}
                      onChange={() => toggleExpert(key, "declined")}
                    />
                    {key.replace(/_/g, " ")}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={pending || !successDef.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Saving…" : activeIntent && superseding ? "Supersede & activate" : "Activate intent"}
          </button>
        </form>
      )}

      {eicEnabled && planPreview && (
        <section className="space-y-4 rounded-lg border border-black/10 p-4 dark:border-white/10">
          <h3 className="font-serif text-lg font-semibold">Recommended editorial team</h3>
          <ExpertPlanList title="Recommended" experts={planPreview.recommended_experts} />
          <ExpertPlanList title="Optional" experts={planPreview.optional_experts} />
          <ExpertPlanList title="Experimental" experts={planPreview.experimental_experts} />
          <ExpertPlanList title="Unavailable (planned)" experts={planPreview.unavailable_experts} />
          <ExpertPlanList title="Declined" experts={planPreview.declined_experts} />
          {planPreview.estimated_runtime_range && (
            <p className="text-xs text-black/45 dark:text-white/45">
              Estimated runtime: {planPreview.estimated_runtime_range}
            </p>
          )}
        </section>
      )}

      {history.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-serif text-lg font-semibold">Intent history</h3>
          <ul className="space-y-2 text-sm">
            {history.map((h) => (
              <li
                key={h.id}
                className="rounded border border-black/10 px-3 py-2 dark:border-white/10"
              >
                <span className="font-medium">{AUTHOR_INTENT_TYPE_LABELS[h.intent_type]}</span>
                <span className="ml-2 text-xs uppercase text-black/45">{h.status}</span>
                <p className="mt-1 text-black/55 dark:text-white/55">{h.author_success_definition}</p>
                <p className="mt-1 text-xs text-black/40">
                  {new Date(h.created_at).toLocaleString()}
                  {h.supersedes_intent_id ? " · supersedes prior" : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
