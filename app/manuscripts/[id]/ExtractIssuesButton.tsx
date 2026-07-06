"use client";

import { useActionState } from "react";
import { extractIssues, type ExtractIssuesState } from "@/app/actions/issues";

const initialState: ExtractIssuesState = { ok: false };

export default function ExtractIssuesButton({ manuscriptId }: { manuscriptId: string }) {
  const [state, action, pending] = useActionState(extractIssues, initialState);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="manuscriptId" value={manuscriptId} />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-indigo-600 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
        >
          {pending ? "Extracting…" : "Extract issues from reviews"}
        </button>
        {state.ok && state.message && (
          <span className="text-sm text-green-600">{state.message}</span>
        )}
      </div>
      {state.errors?.length ? (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-red-600">
          {state.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
