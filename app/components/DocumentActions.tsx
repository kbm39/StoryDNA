"use client";

import { useTransition } from "react";
import { deleteDocument } from "@/app/actions/documents";

export default function DocumentActions({ id, manuscriptId }: { id: string; manuscriptId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this document?")) return;
        start(async () => {
          await deleteDocument(id, manuscriptId);
        });
      }}
      className="text-sm text-red-600 hover:underline disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
