"use client";

import { useCallback, useEffect, useState } from "react";
import { getStudioWorkflowProgress } from "@/app/studio/actions/expert-execution.ts";
import type { StudioWorkflowProgressView } from "@/lib/studio/types.ts";
import { getSupabaseBrowser, isSupabaseBrowserConfigured } from "@/lib/supabase/browser";

const POLL_MS = 4000;

export function useStudioWorkflowSubscription(
  manuscriptId: string,
  initial: StudioWorkflowProgressView,
) {
  const [progress, setProgress] = useState(initial);

  const refresh = useCallback(async (targetManuscriptId: string) => {
    const next = await getStudioWorkflowProgress(targetManuscriptId);
    if (next) setProgress(next);
    return next;
  }, []);

  const workflowId = progress.workflow.workflowId;
  const isTerminal = progress.workflow.isTerminal;

  useEffect(() => {
    if (isTerminal) return;

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      await refresh(manuscriptId);
    };

    void poll();
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
          .channel(`studio-editorial-workflow-${workflowId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "editorial_workflows",
              filter: `id=eq.${workflowId}`,
            },
            () => {
              void poll();
            },
          )
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "editorial_workflow_events",
              filter: `workflow_id=eq.${workflowId}`,
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
  }, [isTerminal, manuscriptId, refresh, workflowId]);

  return { progress, refresh };
}
