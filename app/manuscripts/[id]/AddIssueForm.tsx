"use client";

import { useActionState, useEffect, useRef } from "react";
import { addIssue, type AddIssueState } from "@/app/actions/issues";

const initialState: AddIssueState = { ok: false };

export default function AddIssueForm({ manuscriptId }: { manuscriptId: string }) {
  const [state, action, pending] = useActionState(addIssue, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form
      ref={formRef}
      action={action}
      className="flex flex-col gap-2 rounded-lg border border-dashed border-black/15 p-3 dark:border-white/20"
    >
      <input type="hidden" name="manuscriptId" value={manuscriptId} />
      <input
        name="title"
        placeholder="Add your own issue…"
        required
        className="w-full rounded-md border border-black/15 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-white/20"
      />
      <textarea
        name="description"
        placeholder="Details (optional)"
        rows={2}
        className="w-full resize-y rounded-md border border-black/15 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-white/20"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black/[.08] px-3 py-1.5 text-sm font-medium hover:bg-black/[.12] disabled:opacity-60 dark:bg-white/10 dark:hover:bg-white/15"
        >
          {pending ? "Adding…" : "Add issue"}
        </button>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
