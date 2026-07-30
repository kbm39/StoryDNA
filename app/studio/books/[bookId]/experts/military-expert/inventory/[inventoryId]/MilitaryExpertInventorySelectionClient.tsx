"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type {
  MilitaryExpertSceneInventoryDocument,
  MilitaryExpertSceneSelectionEntry,
  MilitaryExpertSelectionSnapshot,
} from "@/lib/studio/military-expert-v2/contracts.ts";
import { formatAuthorLocator } from "@/lib/studio/military-expert-v2/locator.ts";
import {
  MILITARY_EXPERT_WARNING_COPY,
  MILITARY_EXPERT_WARNING_SUMMARY_COPY,
  computeActiveWarnings,
  isSceneSelectionLocked,
  perSceneWarnings,
} from "@/lib/studio/military-expert-v2/selection-policy.ts";
import {
  BUDGET_EXCEEDED_COPY,
  ESTIMATE_DISCLAIMER_COPY,
  estimateSelectionTotals,
  formatEstimatedCost,
  formatEstimatedRuntime,
} from "@/lib/studio/military-expert-v2/estimator.ts";
import {
  bulkUpdateMilitaryExpertV2Selection,
  confirmMilitaryExpertV2Selection,
  updateMilitaryExpertV2Selection,
} from "@/app/studio/actions/military-expert-v2-selection.ts";

type FilterKey =
  | "all"
  | "major"
  | "firefight"
  | "breach"
  | "convoy"
  | "aviation"
  | "casualty"
  | "planning"
  | "selected";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "major", label: "Major" },
  { key: "firefight", label: "Firefight/Battle" },
  { key: "breach", label: "Breach/Entry" },
  { key: "convoy", label: "Convoy/Vehicle" },
  { key: "aviation", label: "Aviation" },
  { key: "casualty", label: "Casualty" },
  { key: "planning", label: "Planning/Comms" },
  { key: "selected", label: "Selected only" },
];

function matchesFilter(
  filter: FilterKey,
  scene: MilitaryExpertSceneInventoryDocument["scenes"][number],
  isSelected: boolean,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "major":
      return scene.priority_tier === "major";
    case "firefight":
      return scene.scene_types.some((t) => t === "firefight" || t === "battle");
    case "breach":
      return scene.scene_types.some((t) => t === "breach" || t === "room_entry");
    case "convoy":
      return scene.scene_types.some((t) => t === "convoy" || t === "vehicle_contact");
    case "aviation":
      return scene.scene_types.some(
        (t) => t === "aviation_insertion" || t === "aviation_extraction",
      );
    case "casualty":
      return scene.scene_types.some(
        (t) => t === "casualty_under_fire" || t === "casualty_evacuation",
      );
    case "planning":
      return scene.scene_types.some(
        (t) =>
          t === "mission_planning" ||
          t === "intelligence" ||
          t === "communications" ||
          t === "command_decision",
      );
    case "selected":
      return isSelected;
  }
}

export function MilitaryExpertInventorySelectionClient({
  bookId,
  inventory,
  initialSelections,
  confirmedSnapshot,
}: {
  bookId: string;
  inventory: MilitaryExpertSceneInventoryDocument;
  initialSelections: MilitaryExpertSceneSelectionEntry[];
  confirmedSnapshot: MilitaryExpertSelectionSnapshot | null;
}) {
  const [selections, setSelections] = useState(initialSelections);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [scopeAck, setScopeAck] = useState(false);
  const [warningsAck, setWarningsAck] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(confirmedSnapshot);

  const selectionByScene = useMemo(
    () => new Map(selections.map((s) => [s.scene_id, s])),
    [selections],
  );
  const selectedIds = useMemo(
    () => new Set(selections.filter((s) => s.is_selected).map((s) => s.scene_id)),
    [selections],
  );
  const totals = useMemo(
    () => estimateSelectionTotals(inventory.scenes, selectedIds),
    [inventory.scenes, selectedIds],
  );
  const warnings = useMemo(
    () => computeActiveWarnings(inventory.scenes, selections),
    [inventory.scenes, selections],
  );

  const filteredScenes = inventory.scenes.filter((scene) =>
    matchesFilter(filter, scene, selectedIds.has(scene.scene_id)),
  );

  function toggleScene(sceneId: string, isSelected: boolean) {
    if (confirmed?.immutable) return;
    setError(null);
    start(async () => {
      const result = await updateMilitaryExpertV2Selection({
        manuscriptId: bookId,
        inventoryId: inventory.inventory_id,
        sceneId,
        isSelected,
      });
      if (!result.ok) {
        setError(result.error ?? "Unable to update selection.");
        return;
      }
      setSelections((prev) =>
        prev.map((sel) =>
          sel.scene_id === sceneId
            ? {
                ...sel,
                is_selected: isSelected,
                selected_at: isSelected ? new Date().toISOString() : null,
              }
            : sel,
        ),
      );
    });
  }

  function runBulk(action: "review_all" | "restore_recommended" | "clear_optional") {
    if (confirmed?.immutable) return;
    setError(null);
    start(async () => {
      const result = await bulkUpdateMilitaryExpertV2Selection({
        manuscriptId: bookId,
        inventoryId: inventory.inventory_id,
        action,
      });
      if (!result.ok) {
        setError(result.error ?? "Bulk action failed.");
        return;
      }
      window.location.reload();
    });
  }

  function confirmSelection() {
    setError(null);
    start(async () => {
      const result = await confirmMilitaryExpertV2Selection({
        manuscriptId: bookId,
        inventoryId: inventory.inventory_id,
        warningsAcknowledged: warnings.length === 0 || warningsAck,
      });
      if (!result.ok) {
        setError(result.error ?? "Unable to confirm selection.");
        return;
      }
      window.location.reload();
    });
  }

  if (confirmed?.immutable) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-950">
          <p className="font-semibold">Scene inventory and review scope saved</p>
          <p className="mt-2">
            Your Military Expert scene inventory and review scope are saved. Detailed scene review
            is not enabled in this build yet.
          </p>
          <p className="mt-2 text-black/65">
            Selected {confirmed.totals.selected_scene_count} of {inventory.scene_count} scenes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="font-serif text-2xl font-semibold">Choose scenes for Military Expert review</h2>
        <p className="text-sm text-black/65">
          {inventory.scene_count} scenes found · {selectedIds.size} selected
        </p>
        <p className="text-sm font-medium">
          Estimated review cost: {formatEstimatedCost(totals.totalCostUsd)}
        </p>
        <p className="text-sm">
          Estimated completion time:{" "}
          {formatEstimatedRuntime(totals.runtimeMinSeconds, totals.runtimeMaxSeconds)}
        </p>
        <p className="text-xs text-black/55">{ESTIMATE_DISCLAIMER_COPY}</p>
      </header>

      <section className="rounded-xl border border-black/10 bg-paper p-4 text-sm dark:border-white/10">
        <h3 className="font-semibold">Scope</h3>
        <p className="mt-2 text-black/65">
          StoryDNA found {inventory.scene_count} military or tactical scenes in this manuscript.
          Only the scenes you select will receive detailed military-authenticity review. Unselected
          scenes will still appear in your final inventory, but they will not receive detailed
          findings.
        </p>
      </section>

      <section>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
                filter === f.key
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-black/10 text-black/65"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => runBulk("review_all")}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Review All
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => runBulk("restore_recommended")}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Restore Recommended
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => runBulk("clear_optional")}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Clear Optional
          </button>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-1 lg:grid-cols-1">
        {filteredScenes.map((scene) => {
          const sel = selectionByScene.get(scene.scene_id);
          const isSelected = sel?.is_selected ?? false;
          const locked = isSceneSelectionLocked(scene, inventory.mode, false);
          const rowWarnings = perSceneWarnings(scene, isSelected);
          return (
            <article
              key={scene.scene_id}
              className="rounded-xl border border-black/10 bg-paper p-4 dark:border-white/10"
            >
              <div className="flex flex-wrap items-start gap-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={pending || locked}
                  onChange={(e) => toggleScene(scene.scene_id, e.target.checked)}
                  aria-label={`Select ${scene.scene_id}`}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-mono font-medium">{scene.scene_id}</span>
                    <span className="text-black/55">{formatAuthorLocator(scene.locator)}</span>
                    <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-xs uppercase">
                      {scene.priority_tier}
                    </span>
                    <span className="text-xs text-black/55">
                      {scene.scene_types.slice(0, 3).join(", ")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-black/75">{scene.two_sentence_description}</p>
                  {sel ? (
                    <p className="mt-2 text-xs text-black/55">
                      +{formatEstimatedCost(sel.estimated_cost_usd)} · ~
                      {Math.max(1, Math.round(sel.estimated_runtime_seconds / 60))} min
                    </p>
                  ) : null}
                  {rowWarnings.map((code) => (
                    <p key={code} className="mt-2 text-xs text-amber-800">
                      {MILITARY_EXPERT_WARNING_COPY[code]}
                    </p>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <section className="rounded-xl border border-accent/30 bg-accent/5 p-5">
        <h3 className="font-serif text-lg font-semibold">Confirm review scope</h3>
        <p className="mt-2 text-sm">
          You selected {selectedIds.size} scenes for detailed review. StoryDNA will review only
          those scenes when scene-level review is enabled.
        </p>
        <p className="mt-1 text-sm font-medium">
          Estimated cost: {formatEstimatedCost(totals.totalCostUsd)} · Estimated time:{" "}
          {formatEstimatedRuntime(totals.runtimeMinSeconds, totals.runtimeMaxSeconds)}
        </p>
        {warnings.length > 0 ? (
          <div className="mt-3 space-y-2 text-sm text-amber-900">
            <p>{MILITARY_EXPERT_WARNING_SUMMARY_COPY}</p>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={warningsAck}
                onChange={(e) => setWarningsAck(e.target.checked)}
                className="mt-1"
              />
              <span>I understand unselected scene types will not receive detailed findings.</span>
            </label>
          </div>
        ) : (
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={scopeAck}
              onChange={(e) => setScopeAck(e.target.checked)}
              className="mt-1"
            />
            <span>I understand unselected scenes will not receive detailed findings.</span>
          </label>
        )}
        {totals.exceedsBudget ? (
          <p className="mt-3 text-sm text-red-700">
            {BUDGET_EXCEEDED_COPY(totals.budgetLimitUsd)}
          </p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/studio/books/${bookId}/experts`}
            className="rounded-lg border border-black/10 px-4 py-2 text-sm"
          >
            Cancel
          </Link>
          <button
            type="button"
            disabled={
              pending ||
              selectedIds.size < 1 ||
              totals.exceedsBudget ||
              (warnings.length > 0 ? !warningsAck : !scopeAck)
            }
            onClick={confirmSelection}
            className="rounded-lg bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Confirm Selection
          </button>
        </div>
      </section>
    </div>
  );
}
