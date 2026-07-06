"use client";

import { useTransition } from "react";
import { deleteTreatment } from "@/app/actions/treatments";

export default function TreatmentActions({
  id,
  manuscriptId,
}: {
  id: string;
  manuscriptId: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(async () => await deleteTreatment(id, manuscriptId))}
      disabled={pending}
      className="text-xs text-black/40 hover:text-red-600 disabled:opacity-50 dark:text-white/40"
    >
      Delete
    </button>
  );
}
