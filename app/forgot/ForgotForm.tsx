"use client";

import { useActionState } from "react";
import { requestReset, type ResetRequestState } from "@/app/login/actions";

const initial: ResetRequestState = {};

export default function ForgotForm() {
  const [state, action, pending] = useActionState(requestReset, initial);

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-black/60 dark:text-white/60">
        We’ll email a one-time reset link to the account’s email address.
      </p>
      <button
        type="submit"
        disabled={pending || state.ok}
        className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Sending…" : state.ok ? "Email sent" : "Email me a reset link"}
      </button>
      {state.message && <p className="text-sm text-green-600">{state.message}</p>}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <p className="text-center text-sm">
        <a href="/login" className="text-accent hover:underline">
          Back to sign in
        </a>
      </p>
    </form>
  );
}
