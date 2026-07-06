"use client";

import { useTransition } from "react";
import { deletePitchDeck } from "@/app/actions/decks";

export default function DeckActions({
  id,
  manuscriptId,
  seriesId,
}: {
  id: string;
  manuscriptId?: string;
  seriesId?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this pitch deck?")) return;
        start(async () => {
          await deletePitchDeck(id, { manuscriptId, seriesId });
        });
      }}
      className="text-sm text-red-600 hover:underline disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
