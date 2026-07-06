"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  createSeries,
  assignBookToSeries,
  removeBookFromSeries,
} from "@/app/actions/series";

export default function SeriesAssignPanel({
  manuscriptId,
  currentSeriesId,
  currentSeriesTitle,
  currentOrder,
  allSeries,
}: {
  manuscriptId: string;
  currentSeriesId: string | null;
  currentSeriesTitle: string | null;
  currentOrder: number | null;
  allSeries: { id: string; title: string }[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"existing" | "new">(allSeries.length ? "existing" : "new");
  const [pickedSeries, setPickedSeries] = useState(allSeries[0]?.id ?? "");
  const [newTitle, setNewTitle] = useState("");
  const [order, setOrder] = useState<string>(currentOrder != null ? String(currentOrder) : "");

  function save() {
    setError(null);
    const ord = order.trim() ? Number(order) : null;
    start(async () => {
      let res;
      if (mode === "new") {
        res = await createSeries(newTitle, manuscriptId);
      } else {
        if (!pickedSeries) {
          setError("Pick a series.");
          return;
        }
        res = await assignBookToSeries(manuscriptId, pickedSeries, ord);
      }
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else setNewTitle("");
    });
  }

  function saveOrderOnly() {
    if (!currentSeriesId) return;
    setError(null);
    const ord = order.trim() ? Number(order) : null;
    start(async () => {
      const res = await assignBookToSeries(manuscriptId, currentSeriesId, ord);
      if (!res.ok) setError(res.error ?? "Something went wrong.");
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-black/10 bg-paper p-5 dark:border-white/15 dark:bg-white/5">
      {currentSeriesId ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>
            Part of{" "}
            <Link href={`/series/${currentSeriesId}`} className="font-medium text-accent hover:underline">
              {currentSeriesTitle ?? "series"}
            </Link>
            {currentOrder != null ? ` · Book ${currentOrder}` : ""}
          </span>
          <span className="text-black/40 dark:text-white/40">·</span>
          <label className="flex items-center gap-1">
            Book #
            <input
              type="number"
              min={1}
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              className="w-16 rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20"
            />
          </label>
          <button
            type="button"
            onClick={saveOrderOnly}
            disabled={pending}
            className="rounded-md bg-black/[.08] px-2.5 py-1 text-sm font-medium hover:bg-black/[.12] disabled:opacity-60 dark:bg-white/10 dark:hover:bg-white/15"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              if (!confirm("Remove this book from the series?")) return;
              start(async () => {
                await removeBookFromSeries(manuscriptId, currentSeriesId);
              });
            }}
            disabled={pending}
            className="ml-auto text-sm text-red-600 hover:underline disabled:opacity-50"
          >
            Remove from series
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-black/60 dark:text-white/60">
            This book isn’t part of a series. Link it to build a cohesive series treatment & pitch deck.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {allSeries.length > 0 && (
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  checked={mode === "existing"}
                  onChange={() => setMode("existing")}
                  className="accent-indigo-600"
                />
                Add to
              </label>
            )}
            {allSeries.length > 0 && (
              <select
                value={pickedSeries}
                onChange={(e) => {
                  setPickedSeries(e.target.value);
                  setMode("existing");
                }}
                className="rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20"
              >
                {allSeries.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            )}
            <label className="flex items-center gap-1 text-sm">
              <input
                type="radio"
                checked={mode === "new"}
                onChange={() => setMode("new")}
                className="accent-indigo-600"
              />
              New series
            </label>
            {mode === "new" && (
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Series title"
                className="rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20"
              />
            )}
            <label className="flex items-center gap-1 text-sm">
              Book #
              <input
                type="number"
                min={1}
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                className="w-16 rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20"
              />
            </label>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
            >
              {pending ? "Saving…" : "Link"}
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
