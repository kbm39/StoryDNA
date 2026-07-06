"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { renameSeries, deleteSeries } from "@/app/actions/series";

export default function SeriesHeader({ seriesId, title }: { seriesId: string; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {editing ? (
        <>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="rounded-md border border-black/15 bg-transparent px-2 py-1 text-2xl font-semibold dark:border-white/20"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await renameSeries(seriesId, value);
                setEditing(false);
              })
            }
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
          >
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-sm text-black/55 hover:underline dark:text-white/55">
            Cancel
          </button>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <button type="button" onClick={() => setEditing(true)} className="text-sm text-accent hover:underline">
            Rename
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm("Delete this series? The books stay; they’re just unlinked.")) return;
              start(async () => {
                await deleteSeries(seriesId);
                router.push("/");
              });
            }}
            className="text-sm text-red-600 hover:underline disabled:opacity-50"
          >
            Delete series
          </button>
        </>
      )}
    </div>
  );
}
