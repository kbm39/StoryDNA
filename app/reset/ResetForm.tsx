"use client";

import { useActionState } from "react";
import { resetPassword, type ResetState } from "@/app/login/actions";

const initial: ResetState = {};

export default function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, initial);

  if (!token) {
    return (
      <p className="text-sm text-red-600">
        Missing reset token. Use the link from your email, or{" "}
        <a href="/forgot" className="text-accent hover:underline">
          request a new one
        </a>
        .
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-medium">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoFocus
          required
          minLength={6}
          className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent dark:border-white/20"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="confirm" className="block text-sm font-medium">
          Confirm new password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={6}
          className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent dark:border-white/20"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Updating…" : "Set new password"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
