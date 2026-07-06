"use client";

import { useState, useTransition } from "react";
import {
  addSubmission,
  updateSubmission,
  deleteSubmission,
} from "@/app/actions/submissions";
import type { AgentSubmission, SubmissionStatus } from "@/lib/types";
import type { AgentOption } from "@/lib/agentfinder";

const STATUS: { value: SubmissionStatus; label: string }[] = [
  { value: "querying", label: "Querying" },
  { value: "no_response", label: "No response" },
  { value: "rejected", label: "Rejected" },
  { value: "partial_request", label: "Partial request" },
  { value: "full_request", label: "Full request" },
  { value: "offer", label: "Offer!" },
  { value: "withdrawn", label: "Withdrawn" },
];

const STATUS_CLASS: Record<SubmissionStatus, string> = {
  querying: "bg-black/[.06] dark:bg-white/10",
  no_response: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-200",
  partial_request: "bg-blue-100 text-blue-900 dark:bg-blue-500/15 dark:text-blue-200",
  full_request: "bg-indigo-100 text-indigo-900 dark:bg-indigo-500/15 dark:text-indigo-200",
  offer: "bg-green-100 text-green-900 dark:bg-green-500/15 dark:text-green-200",
  withdrawn: "bg-black/[.04] text-black/50 dark:bg-white/5 dark:text-white/50",
};

export default function SubmissionTracker({
  manuscriptId,
  agents,
  submissions,
}: {
  manuscriptId: string;
  agents: AgentOption[];
  submissions: AgentSubmission[];
}) {
  const [pending, start] = useTransition();
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [queriedOn, setQueriedOn] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    if (!agentId) {
      setError("Pick an agent.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await addSubmission(manuscriptId, agentId, queriedOn || null);
      if (!res.ok) setError(res.error ?? "Failed to add.");
      else setQueriedOn("");
    });
  }

  function patch(id: string, fields: Parameters<typeof updateSubmission>[2]) {
    start(async () => {
      await updateSubmission(id, manuscriptId, fields);
    });
  }

  return (
    <div className="space-y-3">
      {agents.length > 0 && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-black/10 bg-paper p-4 dark:border-white/15 dark:bg-white/5">
          <label className="flex flex-col gap-1 text-xs text-black/55 dark:text-white/55">
            Agent
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="rounded-md border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.agency ? ` — ${a.agency}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-black/55 dark:text-white/55">
            Date queried
            <input
              type="date"
              value={queriedOn}
              onChange={(e) => setQueriedOn(e.target.value)}
              className="rounded-md border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20"
            />
          </label>
          <button
            type="button"
            onClick={add}
            disabled={pending}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
          >
            Add submission
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      )}

      {submissions.length === 0 ? (
        <p className="text-sm text-black/55 dark:text-white/55">
          No submissions logged yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/15">
          <table className="w-full text-sm">
            <thead className="bg-black/[.03] text-left text-xs uppercase tracking-wide text-black/50 dark:bg-white/5 dark:text-white/50">
              <tr>
                <th className="px-3 py-2 font-medium">Agent</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Queried</th>
                <th className="px-3 py-2 font-medium">Responded</th>
                <th className="px-3 py-2 font-medium">Notes</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10 dark:divide-white/10">
              {submissions.map((s) => (
                <tr key={s.id} className="align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{s.agent_name ?? "Agent"}</div>
                    {s.agency && (
                      <div className="text-xs text-black/45 dark:text-white/45">{s.agency}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      defaultValue={s.status}
                      onChange={(e) => patch(s.id, { status: e.target.value as SubmissionStatus })}
                      className={`rounded-md px-2 py-1 text-xs font-medium ${STATUS_CLASS[s.status]} border border-black/10 dark:border-white/10`}
                    >
                      {STATUS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      defaultValue={s.queried_on ?? ""}
                      onChange={(e) => patch(s.id, { queried_on: e.target.value || null })}
                      className="rounded-md border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/20"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      defaultValue={s.responded_on ?? ""}
                      onChange={(e) => patch(s.id, { responded_on: e.target.value || null })}
                      className="rounded-md border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/20"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      defaultValue={s.notes ?? ""}
                      placeholder="—"
                      onBlur={(e) => {
                        if ((e.target.value || null) !== (s.notes ?? null))
                          patch(s.id, { notes: e.target.value || null });
                      }}
                      className="w-40 rounded-md border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/20"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (!confirm("Remove this submission?")) return;
                        start(async () => {
                          await deleteSubmission(s.id, manuscriptId);
                        });
                      }}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
