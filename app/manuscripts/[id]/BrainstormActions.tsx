"use client";

import { useTransition } from "react";
import { toggleBrainstormSelected, deleteBrainstorm } from "@/app/actions/brainstorms";

export default function BrainstormActions({
  id,
  manuscriptId,
  selected,
}: {
  id: string;
  manuscriptId: string;
  selected: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center gap-3 text-xs">
      <button
        type="button"
        onClick={() => start(async () => await toggleBrainstormSelected(id, manuscriptId, !selected))}
        disabled={pending}
        className={`rounded px-2 py-0.5 font-medium disabled:opacity-50 ${
          selected
            ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
            : "border border-black/20 hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/10"
        }`}
      >
        {selected ? "★ Picked" : "☆ Pick this"}
      </button>
      <button
        type="button"
        onClick={() => start(async () => await deleteBrainstorm(id, manuscriptId))}
        disabled={pending}
        className="text-black/40 hover:text-red-600 disabled:opacity-50 dark:text-white/40"
      >
        Delete
      </button>
    </div>
  );
}
