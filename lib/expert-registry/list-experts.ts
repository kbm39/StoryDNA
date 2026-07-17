import "server-only";

import {
  getActiveExpertVersion,
  getExpertByKey,
  listExpertVersions,
  listExperts,
} from "./store.ts";
import type { ExpertRow, ExpertScope, ExpertVersionRow } from "./types.ts";

export interface ExpertListEntry {
  expert: ExpertRow;
  activeVersion: ExpertVersionRow | null;
  versionCount: number;
}

/** Read-only inspection utility — no writes. */
export async function listExpertsWithActiveVersions(): Promise<ExpertListEntry[]> {
  const experts = await listExperts();
  const entries: ExpertListEntry[] = [];
  for (const expert of experts) {
    const versions = await listExpertVersions(expert.id);
    const activeVersion = versions.find((v) => v.lifecycle_status === "active") ?? null;
    entries.push({
      expert,
      activeVersion,
      versionCount: versions.length,
    });
  }
  return entries;
}

export async function inspectExpertByKey(args: {
  expertKey: string;
  scope: ExpertScope;
  manuscriptId?: string | null;
}): Promise<{
  expert: ExpertRow | null;
  activeVersion: ExpertVersionRow | null;
  versions: ExpertVersionRow[];
}> {
  const expert = await getExpertByKey(args);
  if (!expert) {
    return { expert: null, activeVersion: null, versions: [] };
  }
  const versions = await listExpertVersions(expert.id);
  const activeVersion = await getActiveExpertVersion(expert.id);
  return { expert, activeVersion, versions };
}
