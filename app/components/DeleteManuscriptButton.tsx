"use client";

import { useState, useTransition } from "react";
import { deleteManuscript } from "@/app/actions/manuscripts";

export default function DeleteManuscriptButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    if (
      !confirm(
        `Delete “${title}”?\n\nThis permanently removes the manuscript, its file, and everything derived from it (reviews, issues, suggestions, editorial analysis, treatments, etc.). This can’t be undone.`,
      )
    ) {
      return;
    }
    setError(null);
    start(async () => {
      const r = await deleteManuscript(id);
      if (!r.ok) setError(r.error ?? "Delete failed.");
    });
  }

  return (
    <div className="absolute right-2 top-2 z-10 flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        aria-label={`Delete ${title}`}
        title="Delete manuscript"
        className="rounded-md px-2 py-1 text-xs font-medium text-black/35 opacity-0 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 disabled:opacity-50 group-hover:opacity-100 dark:text-white/35 dark:hover:bg-red-500/10 dark:hover:text-red-400"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && (
        <span className="max-w-[12rem] rounded bg-red-50 px-1.5 py-0.5 text-right text-[11px] text-red-600 dark:bg-red-500/10">
          {error}
        </span>
      )}
    </div>
  );
}
