"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateReviews } from "@/app/actions/reviews";
import {
  getRevisionGenerationStatus,
  runFreshEditorialGeneration,
} from "@/app/actions/agent-revisions";

export default function GenerateReviewsButton({
  manuscriptId,
  hasCommercial,
  hasCraft,
}: {
  manuscriptId: string;
  hasCommercial: boolean;
  hasCraft: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  const [running, setRunning] = useState<"openai" | "anthropic" | "both" | null>(null);

  function run(mode: "openai" | "anthropic" | "both") {
    setErrors([]);
    setRunning(mode);
    startTransition(async () => {
      const errs: string[] = [];

      if (mode === "openai" || mode === "both") {
        const status = await getRevisionGenerationStatus(manuscriptId);
        if (status.hasAuthorResponses) {
          errs.push(
            `Cannot regenerate Literary Agent review: ${status.authorResponseCount} author response${
              status.authorResponseCount === 1 ? " has" : "s have"
            } already been recorded in Suggested Edits.`,
          );
          setErrors(errs);
          setRunning(null);
          return;
        }

        const literary = await runFreshEditorialGeneration(manuscriptId);
        if (!literary.ok) {
          errs.push(literary.error ?? "Literary Agent generation failed.");
          setErrors(errs);
          setRunning(null);
          return;
        }
      }

      if (mode === "anthropic" || mode === "both") {
        const craft = await generateReviews(manuscriptId, ["anthropic"]);
        if (!craft.ok) errs.push(...(craft.errors ?? []));
      }

      setErrors(errs);
      setRunning(null);
      if (errs.length === 0) router.refresh();
    });
  }

  const label = (mode: "openai" | "anthropic", has: boolean) =>
    pending && (running === mode || running === "both")
      ? "…"
      : has
        ? "Regenerate"
        : "Generate";

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-black/50 dark:text-white/50">Reviews:</span>
        <button
          type="button"
          onClick={() => run("openai")}
          disabled={pending}
          className="rounded-md border border-emerald-600/60 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
        >
          {label("openai", hasCommercial)} Literary Agent
        </button>
        <button
          type="button"
          onClick={() => run("anthropic")}
          disabled={pending}
          className="rounded-md border border-indigo-600/60 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-indigo-300 dark:hover:bg-accent-hover/10"
        >
          {label("anthropic", hasCraft)} Claude
        </button>
        <button
          type="button"
          onClick={() => run("both")}
          disabled={pending}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending && running === "both" ? "Generating…" : "Both"}
        </button>
      </div>
      {pending && (
        <span className="text-xs text-black/50 dark:text-white/50">
          {running === "anthropic"
            ? "Reading the full manuscript — this can take a minute."
            : running === "both"
              ? "Publishing Literary Agent atomically, then generating Claude review…"
              : "Publishing Literary Agent review and revision candidates atomically — up to several minutes…"}
        </span>
      )}
      {errors.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-right text-sm text-red-600">
          {errors.map((e, i) => (
            <li key={i} className="text-left">{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
