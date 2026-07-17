"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getPublishingWorkflowStatus,
  type WorkflowClientView,
} from "@/app/actions/editorial-workflows";
import { getSupabaseBrowser, isSupabaseBrowserConfigured } from "@/lib/supabase/browser";

const POLL_MS = 5000;

export function useWorkflowSubscription(initial: WorkflowClientView | null) {
  const [workflow, setWorkflow] = useState<WorkflowClientView | null>(initial);
  const workflowIdRef = useRef<string | null>(initial?.id ?? null);

  useEffect(() => {
    workflowIdRef.current = workflow?.id ?? null;
  }, [workflow?.id]);

  const refresh = useCallback(async () => {
    const id = workflowIdRef.current;
    if (!id) return;
    const next = await getPublishingWorkflowStatus(id);
    if (next) setWorkflow(next);
  }, []);

  useEffect(() => {
    const id = workflow?.id;
    if (!id || workflow.isTerminal) return;

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      await refresh();
    };

    const interval = setInterval(poll, POLL_MS);

    const onFocus = () => {
      void poll();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);

    let channel: ReturnType<ReturnType<typeof getSupabaseBrowser>["channel"]> | null = null;
    if (isSupabaseBrowserConfigured()) {
      try {
        const supabase = getSupabaseBrowser();
        channel = supabase
          .channel(`editorial-workflow-${id}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "editorial_workflows",
              filter: `id=eq.${id}`,
            },
            () => {
              void poll();
            },
          )
          .subscribe();
      } catch {
        // Realtime optional — polling remains authoritative fallback
      }
    }

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      if (channel) {
        void getSupabaseBrowser().removeChannel(channel);
      }
    };
  }, [workflow?.id, workflow?.isTerminal, refresh]);

  return { workflow, setWorkflow, refresh };
}
