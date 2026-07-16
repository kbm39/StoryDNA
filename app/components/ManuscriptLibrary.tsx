"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setManuscriptArchived } from "@/app/actions/manuscripts";
import DeleteManuscriptButton from "@/app/components/DeleteManuscriptButton";
import type { Manuscript } from "@/lib/types";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Card({
  m,
  onDragStart,
  onDragEnd,
}: {
  m: Manuscript;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  return (
    <li
      className="group relative"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", m.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(m.id);
      }}
      onDragEnd={onDragEnd}
    >
      <DeleteManuscriptButton id={m.id} title={m.title} />
      <Link
        href={`/manuscripts/${m.id}`}
        draggable={false}
        className="flex h-full gap-4 rounded-xl border border-black/10 bg-paper p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md dark:border-white/10 dark:bg-white/5"
      >
        <span className="mt-0.5 h-12 w-1.5 shrink-0 rounded-full bg-accent/70" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate font-serif text-lg font-semibold leading-snug group-hover:text-accent">
            {m.title}
          </p>
          <p className="truncate text-xs text-black/45 dark:text-white/45">{m.original_filename}</p>
          <p className="mt-auto pt-3 text-xs text-black/55 dark:text-white/55">
            {m.word_count != null ? `${m.word_count.toLocaleString()} words` : "—"}
            <span className="px-1.5 text-black/25 dark:text-white/25">·</span>
            {formatBytes(m.file_size)}
          </p>
          <p className="text-xs text-black/40 dark:text-white/40">
            Uploaded {fmtDateTime(m.created_at)}
          </p>
        </div>
      </Link>
      {/* drag affordance */}
      <span
        aria-hidden
        title="Drag to move above/below the line"
        className="pointer-events-none absolute bottom-2 right-2 text-black/25 opacity-0 transition group-hover:opacity-100 dark:text-white/25"
      >
        ⇅
      </span>
    </li>
  );
}

export default function ManuscriptLibrary({ manuscripts }: { manuscripts: Manuscript[] }) {
  const [list, setList] = useState(manuscripts);
  const [prevManuscripts, setPrevManuscripts] = useState(manuscripts);
  const [, start] = useTransition();
  const [over, setOver] = useState<null | "current" | "older">(null);
  const [dragging, setDragging] = useState(false);

  // Re-sync when the server revalidates the manuscript list.
  if (manuscripts !== prevManuscripts) {
    setPrevManuscripts(manuscripts);
    setList(manuscripts);
  }

  const current = list.filter((m) => !m.archived);
  const older = list.filter((m) => m.archived);

  function move(id: string, archived: boolean) {
    const m = list.find((x) => x.id === id);
    if (!m || m.archived === archived) return;
    setList((prev) => prev.map((x) => (x.id === id ? { ...x, archived } : x)));
    start(async () => {
      await setManuscriptArchived(id, archived);
    });
  }

  function zoneProps(zone: "current" | "older", archived: boolean) {
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        setOver(zone);
      },
      onDragLeave: (e: React.DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setOver(null);
        setDragging(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) move(id, archived);
      },
    };
  }

  if (list.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-black/15 bg-paper/40 px-5 py-10 text-center text-sm text-black/55 dark:border-white/15 dark:text-white/55">
        No manuscripts yet. Upload your first Word document above.
      </div>
    );
  }

  const onDragStart = () => setDragging(true);
  const onDragEnd = () => {
    setDragging(false);
    setOver(null);
  };

  return (
    <div>
      {/* Current */}
      <div
        {...zoneProps("current", false)}
        className={`rounded-xl transition ${
          over === "current" ? "bg-accent/5 ring-2 ring-accent/40" : ""
        }`}
      >
        {current.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {current.map((m) => (
              <Card key={m.id} m={m} onDragStart={onDragStart} onDragEnd={onDragEnd} />
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-black/15 px-5 py-6 text-center text-sm text-black/45 dark:border-white/15 dark:text-white/45">
            Drag a manuscript up here to make it current.
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="relative my-6">
        <div className="border-t border-black/15 dark:border-white/15" />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs font-semibold uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
          Older versions
        </span>
      </div>

      {/* Older */}
      <div
        {...zoneProps("older", true)}
        className={`rounded-xl transition ${
          over === "older" ? "bg-accent/5 ring-2 ring-accent/40" : ""
        }`}
      >
        {older.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {older.map((m) => (
              <Card key={m.id} m={m} onDragStart={onDragStart} onDragEnd={onDragEnd} />
            ))}
          </ul>
        ) : (
          <div
            className={`rounded-xl border border-dashed px-5 py-8 text-center text-sm transition ${
              dragging
                ? "border-accent/50 text-accent"
                : "border-black/15 text-black/40 dark:border-white/15 dark:text-white/40"
            }`}
          >
            Drag a manuscript below the line to mark it as an older version.
          </div>
        )}
      </div>
    </div>
  );
}
