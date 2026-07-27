import {
  getExpertCatalogEntry,
  listExpertCatalogEntries,
  type ExpertCatalogEntry,
  type ExpertCatalogKey,
} from "@/lib/expert-catalog.ts";
import {
  classifyStudioExpertTier,
  studioExecutionAllowed,
} from "./execution-policy.ts";
import type { StudioExpertDeskEntry, StudioExpertTier } from "./types.ts";

const TIER_LABELS: Record<StudioExpertTier, string> = {
  certified: "Certified",
  validated: "Validated",
  experimental: "Experimental",
  advisory_only: "Advisory Only",
  placeholder: "Not Yet Available",
};

/** Desired Kevin Track catalog — registry first, honest placeholders otherwise. */
const STUDIO_EXPERT_ORDER: readonly {
  key: ExpertCatalogKey | string;
  displayName: string;
  purpose: string;
  placeholder?: boolean;
}[] = [
  {
    key: "literary_agent",
    displayName: "Literary Agent",
    purpose: "Commercial positioning, submission readiness, and revision priorities.",
  },
  {
    key: "developmental_editor",
    displayName: "Developmental Editor",
    purpose: "Plot, structure, pacing, stakes, and narrative architecture.",
  },
  {
    key: "line_editor",
    displayName: "Line Editor",
    purpose: "Prose clarity, rhythm, voice consistency, and word economy.",
  },
  {
    key: "show_vs_tell_editor",
    displayName: "Show vs. Tell Editor",
    purpose: "Scene dramatization, exposition balance, and on-the-page rendering.",
    placeholder: true,
  },
  {
    key: "character_expert",
    displayName: "Character Expert",
    purpose: "Motivation, arc continuity, and character behavior consistency.",
    placeholder: true,
  },
  {
    key: "dialogue_expert",
    displayName: "Dialogue Expert",
    purpose: "Dialogue authenticity, subtext, and voice differentiation.",
    placeholder: true,
  },
  {
    key: "continuity_expert",
    displayName: "Continuity / Canon Expert",
    purpose: "Series canon, timeline continuity, and internal consistency.",
    placeholder: true,
  },
  {
    key: "military_expert",
    displayName: "Military Expert",
    purpose: "Command, rank, tactics, logistics, and operational realism.",
  },
  {
    key: "police_expert",
    displayName: "Police Expert",
    purpose: "Law enforcement procedure, jurisdiction, and investigative realism.",
    placeholder: true,
  },
  {
    key: "psychologist",
    displayName: "Psychologist",
    purpose: "Character motivation, trauma responses, and psychological realism.",
  },
  {
    key: "librarian",
    displayName: "Research Librarian",
    purpose: "Factual accuracy, research questions, and source-supported realism.",
  },
];

function catalogOrNull(key: string): ExpertCatalogEntry | null {
  if (
    key === "literary_agent" ||
    key === "developmental_editor" ||
    key === "line_editor" ||
    key === "psychologist" ||
    key === "librarian" ||
    key === "military_expert"
  ) {
    return getExpertCatalogEntry(key) ?? null;
  }
  return null;
}

function buildDeskEntry(spec: (typeof STUDIO_EXPERT_ORDER)[number]): StudioExpertDeskEntry {
  const catalog = catalogOrNull(spec.key);
  const placeholder = spec.placeholder === true || catalog === null;
  const tier = placeholder ? "placeholder" : classifyStudioExpertTier(catalog);
  const experimentalNotice =
    tier === "experimental" || tier === "advisory_only"
      ? "Experimental — private advisory use only. Not commercially certified."
      : undefined;

  return Object.freeze({
    key: spec.key,
    displayName: catalog?.displayName ?? spec.displayName,
    purpose: catalog?.shortDescription ?? spec.purpose,
    tier,
    tierLabel: TIER_LABELS[tier],
    catalogAvailability: catalog?.availability ?? null,
    certificationStatus: catalog?.certificationStatus ?? null,
    selectionEnabled: catalog?.selectionEnabled ?? false,
    studioExecutionAllowed: studioExecutionAllowed({
      entry: catalog,
      tier,
      context: { routeNamespace: "/studio", privateUseAcknowledged: true },
    }),
    expectedRuntime: tier === "certified" ? "5–15 minutes" : "Not available",
    estimatedCost: tier === "certified" ? "Varies by manuscript length" : null,
    scopeOptions: tier === "certified" ? ["Full manuscript", "Selected chapters"] : ["Full manuscript"],
    prerequisites:
      tier === "certified"
        ? ["Active manuscript version", "StoryDNA intake complete"]
        : ["Private Author Studio access"],
    limitations: placeholder
      ? ["Expert not yet registered in StoryDNA runtime"]
      : tier === "certified"
        ? ["Uses canonical commercial review workflow"]
        : ["Advisory preview only — no production execution path"],
    experimentalNotice,
    placeholder,
  });
}

export function listStudioExpertDeskEntries(): readonly StudioExpertDeskEntry[] {
  return STUDIO_EXPERT_ORDER.map(buildDeskEntry);
}

export function groupStudioExpertsByTier(
  entries: readonly StudioExpertDeskEntry[],
): Record<StudioExpertTier, readonly StudioExpertDeskEntry[]> {
  const groups: Record<StudioExpertTier, StudioExpertDeskEntry[]> = {
    certified: [],
    validated: [],
    experimental: [],
    advisory_only: [],
    placeholder: [],
  };
  for (const entry of entries) {
    groups[entry.tier].push(entry);
  }
  return Object.freeze({
    certified: Object.freeze(groups.certified),
    validated: Object.freeze(groups.validated),
    experimental: Object.freeze(groups.experimental),
    advisory_only: Object.freeze(groups.advisory_only),
    placeholder: Object.freeze(groups.placeholder),
  });
}

/** Ensures commercial catalog entries are not mutated by studio layer. */
export function getCommercialCatalogSnapshot(): readonly ExpertCatalogEntry[] {
  return listExpertCatalogEntries();
}
