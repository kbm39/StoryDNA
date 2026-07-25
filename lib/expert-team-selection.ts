import {
  EXPERT_CATALOG_ENTRIES,
  type ExpertCatalogEntry,
  type ExpertCatalogKey,
} from "./expert-catalog.ts";

export type SelectedExpertKeys = ReadonlySet<ExpertCatalogKey>;

const catalogByKey = new Map(EXPERT_CATALOG_ENTRIES.map((entry) => [entry.key, entry]));

export function createDefaultExpertSelection(): SelectedExpertKeys {
  return new Set<ExpertCatalogKey>(["literary_agent"]);
}

export function getCatalogEntry(key: ExpertCatalogKey): ExpertCatalogEntry {
  const entry = catalogByKey.get(key);
  if (!entry) throw new Error(`Unknown expert catalog key: ${key}`);
  return entry;
}

export function canToggleExpertSelection(entry: ExpertCatalogEntry): boolean {
  return entry.selectionEnabled && entry.availability === "available";
}

export function toggleExpertSelection(
  selected: SelectedExpertKeys,
  key: ExpertCatalogKey,
): SelectedExpertKeys {
  const entry = getCatalogEntry(key);
  if (!canToggleExpertSelection(entry)) {
    return selected;
  }

  const next = new Set(selected);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  return next;
}

export function isExpertSelected(selected: SelectedExpertKeys, key: ExpertCatalogKey): boolean {
  return selected.has(key);
}

export function isLiteraryAgentSelected(selected: SelectedExpertKeys): boolean {
  return selected.has("literary_agent");
}

export function hasLaunchableSelection(selected: SelectedExpertKeys): boolean {
  return isLiteraryAgentSelected(selected);
}

/** Only the certified Literary Agent workflow may launch in Sprint 1. */
export function shouldStartLiteraryAgentWorkflow(selected: SelectedExpertKeys): boolean {
  return isLiteraryAgentSelected(selected);
}

export function listComingSoonExpertKeys(): ExpertCatalogKey[] {
  return EXPERT_CATALOG_ENTRIES.filter((entry) => entry.availability === "coming_soon").map(
    (entry) => entry.key,
  );
}

export function listSelectableExpertKeys(): ExpertCatalogKey[] {
  return EXPERT_CATALOG_ENTRIES.filter((entry) => canToggleExpertSelection(entry)).map(
    (entry) => entry.key,
  );
}
