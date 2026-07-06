"use client";

import { useTransition } from "react";
import { deleteSeriesTreatment } from "@/app/actions/series";

export default function SeriesTreatmentActions({ id, seriesId }: { id: string; seriesId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this series treatment?")) return;
        start(async () => {
          await deleteSeriesTreatment(id, seriesId);
        });
      }}
      className="text-sm text-red-600 hover:underline disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
