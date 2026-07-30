"use client";

import { useState } from "react";
import type { MilitaryExpertSceneInventoryDocument } from "@/lib/studio/military-expert-v2/contracts.ts";
import type { MilitaryExpertSceneReviewDocument } from "@/lib/studio/military-expert-v2/scene-review-contract.ts";
import type { SceneReviewCoverageMetrics } from "@/lib/studio/military-expert-v2/scene-review-coverage.ts";
import type { MilitaryDepthScorecard } from "@/lib/studio/military-expert-v2/scene-review-quality.ts";
import type { PersistedSceneReviewRow } from "@/lib/studio/military-expert-v2/scene-review-persistence.ts";
import { formatAuthorLocator } from "@/lib/studio/military-expert-v2/locator.ts";
import { launchMilitaryExpertV2SceneReview } from "@/app/studio/actions/military-expert-v2-scene-review.ts";
import { launchMilitaryExpertV2Synthesis } from "@/app/studio/actions/military-expert-v2-synthesis.ts";

interface SceneReviewInspectionData {
  readonly bookId: string;
  readonly snapshotId: string;
  readonly inventory: MilitaryExpertSceneInventoryDocument;
  readonly selectedSceneIds: readonly string[];
  readonly workflowStatus: string | null;
  readonly workflowId: string | null;
  readonly coverage: SceneReviewCoverageMetrics | null;
  readonly reviews: readonly PersistedSceneReviewRow[];
  readonly scorecards: readonly MilitaryDepthScorecard[];
  readonly resultSummary: Record<string, unknown> | null;
}

function AuthenticityPointList({
  title,
  points,
}: {
  title: string;
  points: MilitaryExpertSceneReviewDocument["authenticity_strengths"];
}) {
  if (points.length === 0) return null;
  return (
    <div className="mt-3">
      <h4 className="text-sm font-medium">{title}</h4>
      <ul className="mt-1 space-y-2">
        {points.map((p) => (
          <li key={p.title} className="rounded border border-black/10 p-2 text-sm dark:border-white/10">
            <p className="font-medium">{p.title}</p>
            <p className="mt-1 text-black/70 dark:text-white/70">{p.scene_specific_explanation}</p>
            <p className="mt-1 text-xs text-black/55 dark:text-white/55">
              Why it matters: {p.why_it_matters}
            </p>
            <p className="mt-1 text-xs">
              {p.determination === "confirmed" ? "Confirmed" : "Author Review Required"} ·{" "}
              {p.confidence} confidence
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SceneReviewCard({
  scene,
  review,
  scorecard,
}: {
  scene: MilitaryExpertSceneInventoryDocument["scenes"][number];
  review: PersistedSceneReviewRow | undefined;
  scorecard: MilitaryDepthScorecard | undefined;
}) {
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const doc = review?.document;

  return (
    <article className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-medium">{scene.scene_id}</h3>
          <p className="text-sm text-black/55 dark:text-white/55">
            {formatAuthorLocator(scene.locator)} · {scene.scene_types.join(", ")}
          </p>
        </div>
        <span className="rounded bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
          {review?.reviewStatus ?? "not started"}
        </span>
      </div>

      {doc && (
        <>
          <p className="mt-3 text-sm">{doc.realism_summary}</p>
          <AuthenticityPointList title="Strengths" points={doc.authenticity_strengths} />
          <AuthenticityPointList title="Concerns" points={doc.authenticity_concerns} />

          {doc.safe_editorial_suggestions.length > 0 && (
            <div className="mt-3">
              <h4 className="text-sm font-medium">Editorial suggestions</h4>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {doc.safe_editorial_suggestions.map((s) => (
                  <li key={s.suggestion}>{s.suggestion}</li>
                ))}
              </ul>
            </div>
          )}

          {scorecard && (
            <div className="mt-3">
              <h4 className="text-sm font-medium">Military depth scores</h4>
              <dl className="mt-1 grid grid-cols-2 gap-1 text-xs">
                {Object.entries(scorecard.scores).map(([dim, score]) => (
                  <div key={dim} className="flex justify-between gap-2">
                    <dt className="text-black/55 dark:text-white/55">{dim.replace(/_/g, " ")}</dt>
                    <dd>{score}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <button
            type="button"
            className="mt-3 text-xs text-accent hover:underline"
            onClick={() => setShowDiagnostics((v) => !v)}
          >
            {showDiagnostics ? "Hide diagnostics" : "Show diagnostics"}
          </button>
          {showDiagnostics && doc.provider_metadata && (
            <pre className="mt-2 overflow-x-auto rounded bg-black/5 p-2 text-xs dark:bg-white/5">
              {JSON.stringify(doc.provider_metadata, null, 2)}
              {"\n"}Retries: {doc.retry_count} · Repairs: {doc.repair_count}
            </pre>
          )}
        </>
      )}
    </article>
  );
}

export function MilitaryExpertSceneReviewsClient({ data }: { data: SceneReviewInspectionData }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scenes = data.inventory.scenes.filter((s) => data.selectedSceneIds.includes(s.scene_id));
  const reviewByScene = new Map(data.reviews.map((r) => [r.sceneId, r]));
  const scorecardByScene = new Map(data.scorecards.map((s) => [s.sceneId, s]));

  async function handleLaunch() {
    setPending(true);
    setError(null);
    try {
      const result = await launchMilitaryExpertV2SceneReview({
        manuscriptId: data.bookId,
        selectionSnapshotId: data.snapshotId,
      });
      if (!result.ok) setError(result.error ?? "Launch failed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Launch failed.");
    } finally {
      setPending(false);
    }
  }

  async function handleLaunchSynthesis() {
    setPending(true);
    setError(null);
    try {
      const result = await launchMilitaryExpertV2Synthesis({
        manuscriptId: data.bookId,
        selectionSnapshotId: data.snapshotId,
        phase2aWorkflowId: data.workflowId ?? undefined,
      });
      if (!result.ok) setError(result.error ?? "Synthesis launch failed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Synthesis launch failed.");
    } finally {
      setPending(false);
    }
  }

  const coveragePass = data.coverage?.pass === true;

  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-black/10 p-4 dark:border-white/10">
        <p className="text-sm text-black/55 dark:text-white/55">Private calibration screen</p>
        <h1 className="mt-1 text-xl font-semibold">Military Expert V2 Scene Reviews</h1>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-black/55 dark:text-white/55">Snapshot</dt>
            <dd className="font-mono text-xs">{data.snapshotId}</dd>
          </div>
          <div>
            <dt className="text-black/55 dark:text-white/55">Workflow</dt>
            <dd>
              {data.workflowStatus ?? "none"}
              {data.workflowId ? ` · ${data.workflowId.slice(0, 8)}…` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-black/55 dark:text-white/55">Selected scenes</dt>
            <dd>{data.selectedSceneIds.length}</dd>
          </div>
          {data.coverage && (
            <div>
              <dt className="text-black/55 dark:text-white/55">Coverage</dt>
              <dd>
                {data.coverage.coveragePercentage}% · complete {data.coverage.completeCount} · failed{" "}
                {data.coverage.failedCount}
              </dd>
            </div>
          )}
        </dl>

        {!data.workflowId && (
          <button
            type="button"
            disabled={pending}
            onClick={handleLaunch}
            className="mt-4 rounded bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {pending ? "Launching…" : "Launch Phase 2A Scene Review"}
          </button>
        )}
        {coveragePass && data.workflowStatus === "completed" && (
          <button
            type="button"
            disabled={pending}
            onClick={handleLaunchSynthesis}
            className="mt-4 ml-2 rounded bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {pending ? "Launching…" : "Launch Phase 2B Synthesis Report"}
          </button>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </header>

      <div className="space-y-4">
        {scenes.map((scene) => (
          <SceneReviewCard
            key={scene.scene_id}
            scene={scene}
            review={reviewByScene.get(scene.scene_id)}
            scorecard={scorecardByScene.get(scene.scene_id)}
          />
        ))}
      </div>
    </div>
  );
}
