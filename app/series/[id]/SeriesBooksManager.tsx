"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setBookOrder, removeBookFromSeries } from "@/app/actions/series";

export default function SeriesBooksManager({
  seriesId,
  books,
}: {
  seriesId: string;
  books: { id: string; title: string; order: number | null }[];
}) {
  const [pending, start] = useTransition();
  const [orders, setOrders] = useState<Record<string, string>>(
    () => Object.fromEntries(books.map((b) => [b.id, b.order != null ? String(b.order) : ""])),
  );

  if (books.length === 0) {
    return (
      <p className="text-sm text-black/55 dark:text-white/55">
        No books linked yet. Open a manuscript and use its “Series” section to add it here.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/15">
      {books.map((b, i) => (
        <li key={b.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
          <span className="w-6 text-black/40 dark:text-white/40">{i + 1}.</span>
          <Link href={`/manuscripts/${b.id}`} className="font-medium text-accent hover:underline">
            {b.title}
          </Link>
          <label className="ml-auto flex items-center gap-1 text-xs text-black/55 dark:text-white/55">
            Book #
            <input
              type="number"
              min={1}
              value={orders[b.id] ?? ""}
              onChange={(e) => setOrders((o) => ({ ...o, [b.id]: e.target.value }))}
              onBlur={() => {
                const v = orders[b.id]?.trim();
                start(async () => {
                  await setBookOrder(b.id, seriesId, v ? Number(v) : null);
                });
              }}
              disabled={pending}
              className="w-16 rounded-md border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (!confirm(`Remove “${b.title}” from this series?`)) return;
              start(async () => {
                await removeBookFromSeries(b.id, seriesId);
              });
            }}
            disabled={pending}
            className="text-xs text-red-600 hover:underline disabled:opacity-50"
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}
