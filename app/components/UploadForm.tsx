"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadManuscript, type UploadState } from "@/app/actions/manuscripts";

const initialState: UploadState = { ok: false };

function isDocx(file: File): boolean {
  return file.name.toLowerCase().endsWith(".docx");
}

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Uploading…" : "Upload manuscript"}
    </button>
  );
}

export default function UploadForm() {
  const [state, formAction, pending] = useActionState(uploadManuscript, initialState);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);

  // On success, jump straight into StoryDNA discovery (this unmounts the form).
  useEffect(() => {
    if (state.ok && state.id) router.push(`/storydna/${state.id}`);
  }, [state.ok, state.id, router]);

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!isDocx(file)) {
      setDropError("Only Word .docx files are supported.");
      return;
    }
    // Push the dropped file into the real <input> so the form submits it.
    const dt = new DataTransfer();
    dt.items.add(file);
    if (inputRef.current) inputRef.current.files = dt.files;
    setDropError(null);
    setFileName(file.name);
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4 rounded-lg border border-black/10 bg-paper p-5 dark:border-white/15 dark:bg-white/5"
    >
      <div className="space-y-1">
        <label htmlFor="title" className="block text-sm font-medium">
          Title <span className="font-normal text-black/50 dark:text-white/50">(optional)</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          placeholder="Defaults to the file name"
          className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-white/20"
        />
      </div>

      <div className="space-y-1">
        <span className="block text-sm font-medium">Word document (.docx)</span>
        <label
          htmlFor="file"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-8 text-center transition ${
            dragging
              ? "border-accent bg-accent/5"
              : "border-black/15 hover:border-accent/50 hover:bg-black/[.02] dark:border-white/20 dark:hover:bg-white/5"
          }`}
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="mb-1 h-7 w-7 text-black/30 dark:text-white/30"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
          </svg>
          {fileName ? (
            <span className="text-sm font-medium text-accent">{fileName}</span>
          ) : (
            <span className="text-sm text-black/60 dark:text-white/60">
              <span className="font-medium text-accent">Drag &amp; drop</span> a .docx here, or click to
              browse
            </span>
          )}
          <span className="text-xs text-black/40 dark:text-white/40">Word documents only</span>
        </label>
        <input
          ref={inputRef}
          id="file"
          name="file"
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          required
          onChange={(e) => {
            setDropError(null);
            setFileName(e.target.files?.[0]?.name ?? null);
          }}
          className="sr-only"
        />
        {dropError && <p className="text-sm text-red-600">{dropError}</p>}
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton pending={pending} />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.ok && state.message && (
          <p className="text-sm text-green-600">{state.message}</p>
        )}
      </div>
    </form>
  );
}
