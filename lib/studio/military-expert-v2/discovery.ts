import { createHash } from "node:crypto";
import type {
  MilitaryExpertActionCategory,
  MilitaryExpertSceneInventoryEntry,
  MilitaryExpertSceneInventoryDocument,
  MilitaryExpertScenePriorityTier,
  MilitaryExpertSceneType,
} from "./contracts.ts";
import {
  MILITARY_EXPERT_SCENE_INVENTORY_CONTRACT_VERSION,
} from "./contracts.ts";

const MIN_CHUNK_CHARS = 800;
const MAX_CHUNK_CHARS = 12_000;
const MERGE_GAP_CHARS = 400;
const CONTEXT_PAD_CHARS = 200;

interface SignalPattern {
  readonly category: MilitaryExpertActionCategory;
  readonly sceneTypes: readonly MilitaryExpertSceneType[];
  readonly patterns: readonly RegExp[];
  readonly weight: number;
}

const SIGNAL_PATTERNS: readonly SignalPattern[] = [
  {
    category: "firefight_or_battle",
    sceneTypes: ["firefight", "battle"],
    patterns: [
      /\b(?:firefight|fire fight|gunfight|gun fight|exchange of fire|sustained fire|incoming fire|return fire|suppressing fire|contact!|troops in contact)\b/i,
      /\b(?:muzzle flash|tracer|rounds? (?:snapped|cracked|whizzed)|bullets? (?:punched|tore|ripped))\b/i,
    ],
    weight: 3,
  },
  {
    category: "movement_and_cover",
    sceneTypes: ["firefight"],
    patterns: [
      /\b(?:bound(?:ing)?|cover and move|move to cover|low crawl|sprint to|dash(?:ed|ing)? to cover|suppressive fire while)\b/i,
      /\b(?:behind (?:the )?(?:wall|barrier|vehicle|concrete|sandbag))\b/i,
    ],
    weight: 2,
  },
  {
    category: "room_entry_or_breach",
    sceneTypes: ["breach", "room_entry"],
    patterns: [
      /\b(?:breach(?:ing|ed)?|dynamic entry|stack(?:ed|ing)? on the door|room clear|clear the room|kick(?:ed|ing)? (?:in )?the door|flash[- ]?bang|door charge)\b/i,
    ],
    weight: 3,
  },
  {
    category: "ambush_or_contact",
    sceneTypes: ["firefight", "battle"],
    patterns: [
      /\b(?:ambush(?:ed|ing)?|IED|improvised explosive|sniper|contact (?:left|right|front|rear)|sudden (?:attack|gunfire|explosion))\b/i,
    ],
    weight: 3,
  },
  {
    category: "convoy_or_vehicle_movement",
    sceneTypes: ["convoy", "vehicle_contact"],
    patterns: [
      /\b(?:convoy|MRAP|humvee|vehicle patrol|roadside|checkpoint|motorcade|turret|gunner(?:'s)? (?:seat|position))\b/i,
    ],
    weight: 2,
  },
  {
    category: "command_decision",
    sceneTypes: ["command_decision"],
    patterns: [
      /\b(?:command(?:er's)? intent|ROE|rules of engagement|mission brief|execute the plan|on my command|six(?:'s)? (?:call|order))\b/i,
    ],
    weight: 2,
  },
  {
    category: "radio_or_communications",
    sceneTypes: ["communications"],
    patterns: [
      /\b(?:radio|comms|over(?: the)? net|push[- ]?to[- ]?talk|satcom|frequency|call sign|broken arrow|sitrep)\b/i,
    ],
    weight: 1.5,
  },
  {
    category: "weapons_handling",
    sceneTypes: ["weapons_handling"],
    patterns: [
      /\b(?:mag(?:azine)? change|reload(?:ed|ing)?|safety off|chamber(?:ed|ing)?|weapon(?:s)? (?:up|ready|hot)|rifle|pistol|sidearm|carbine)\b/i,
    ],
    weight: 1.5,
  },
  {
    category: "casualty_treatment_or_evacuation",
    sceneTypes: ["casualty_under_fire", "casualty_evacuation"],
    patterns: [
      /\b(?:casualty|wounded|tourniquet|medevac|MEDEVAC|CASEVAC|triage|pressure dressing|bleeding out|KIA|WIA|evac(?:uate)?(?:d|ing)? (?:the )?(?:wounded|casualty))\b/i,
    ],
    weight: 3,
  },
  {
    category: "intelligence_or_planning",
    sceneTypes: ["mission_planning", "intelligence"],
    patterns: [
      /\b(?:intel(?:ligence)?|briefing|mission plan|objective|HVT|target package|recon|surveillance|OP(?:FOR)?|SIGINT|HUMINT)\b/i,
    ],
    weight: 1.5,
  },
  {
    category: "aviation",
    sceneTypes: ["aviation_insertion", "aviation_extraction"],
    patterns: [
      /\b(?:helo|helicopter|black hawk|chinook|fast rope|fast[- ]?rope|insert(?:ion)?|exfil|extraction|LZ|landing zone|rotor wash|door gunner)\b/i,
    ],
    weight: 3,
  },
  {
    category: "military_culture_or_chain_of_command",
    sceneTypes: ["military_culture", "chain_of_command"],
    patterns: [
      /\b(?:salute|NCO|officer|chain of command|rank|deployment|barracks|PT formation|military police|court[- ]?martial)\b/i,
    ],
    weight: 1,
  },
];

interface RawCandidate {
  start: number;
  end: number;
  score: number;
  categories: Set<MilitaryExpertActionCategory>;
  sceneTypes: Set<MilitaryExpertSceneType>;
  matchCount: number;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function excerptHash(text: string, contentHashPrefix: string): string {
  return createHash("sha256")
    .update(contentHashPrefix)
    .update("|")
    .update(text.slice(0, 500))
    .digest("hex")
    .slice(0, 16);
}

function detectChapterLabel(text: string, offset: number): string | null {
  const windowStart = Math.max(0, offset - 2000);
  const before = text.slice(windowStart, offset);
  const chapterMatch = before.match(
    /(?:^|\n)\s*(Chapter\s+\d+(?:\s*[:\u2014-]\s*[^\n]{0,80})?)\s*(?:\n|$)/i,
  );
  return chapterMatch?.[1]?.trim() ?? null;
}

function detectSceneHeading(text: string, start: number, end: number): string | null {
  const excerpt = text.slice(start, Math.min(end, start + 300));
  const headingMatch = excerpt.match(/(?:^|\n)\s*([A-Z][A-Za-z0-9\s'.,-]{2,40})\s*(?:\n|$)/);
  if (!headingMatch) return null;
  const candidate = headingMatch[1]?.trim();
  if (!candidate || candidate.length > 60) return null;
  if (/^(Chapter|CHAPTER)\s+\d/i.test(candidate)) return null;
  return candidate;
}

function classifyPriorityTier(
  score: number,
  sceneTypes: readonly MilitaryExpertSceneType[],
): MilitaryExpertScenePriorityTier {
  const hasMajorType = sceneTypes.some((type) =>
    [
      "firefight",
      "battle",
      "breach",
      "room_entry",
      "casualty_under_fire",
      "aviation_insertion",
      "aviation_extraction",
      "convoy",
      "vehicle_contact",
    ].includes(type),
  );
  if (score >= 6 || (hasMajorType && score >= 4)) return "major";
  if (score >= 3) return "moderate";
  return "minor";
}

function buildTwoSentenceDescription(
  excerpt: string,
  categories: readonly MilitaryExpertActionCategory[],
): string {
  const normalized = normalizeWhitespace(excerpt).slice(0, 400);
  const categoryLabel = categories[0]?.replace(/_/g, " ") ?? "military action";
  const first =
    normalized.length > 20
      ? `${normalized.slice(0, 180).trim()}${normalized.length > 180 ? "…" : ""}`
      : `A sequence involving ${categoryLabel} appears in this section of the manuscript.`;
  const second = `The scene emphasizes ${categories.slice(0, 3).join(", ").replace(/_/g, " ")} and related tactical elements.`;
  return `${first} ${second}`;
}

function scanCandidates(text: string): RawCandidate[] {
  const candidates: RawCandidate[] = [];
  const chunkSize = 3000;
  const step = 1500;

  for (let start = 0; start < text.length; start += step) {
    const end = Math.min(text.length, start + chunkSize);
    const slice = text.slice(start, end);
    let score = 0;
    let matchCount = 0;
    const categories = new Set<MilitaryExpertActionCategory>();
    const sceneTypes = new Set<MilitaryExpertSceneType>();

    for (const signal of SIGNAL_PATTERNS) {
      for (const pattern of signal.patterns) {
        if (pattern.test(slice)) {
          score += signal.weight;
          matchCount += 1;
          categories.add(signal.category);
          for (const type of signal.sceneTypes) sceneTypes.add(type);
          break;
        }
      }
    }

    if (score >= 2) {
      candidates.push({
        start,
        end,
        score,
        categories,
        sceneTypes,
        matchCount,
      });
    }
  }

  return candidates;
}

function hasChapterBoundaryBetween(text: string, end: number, nextStart: number): boolean {
  const between = text.slice(end, nextStart);
  return /(?:^|\n)\s*Chapter\s+\d+/i.test(between);
}

function mergeCandidates(candidates: readonly RawCandidate[], text: string): RawCandidate[] {
  if (candidates.length === 0) return [];
  const sorted = [...candidates].sort((a, b) => a.start - b.start);
  const merged: RawCandidate[] = [];
  let current = { ...sorted[0]!, categories: new Set(sorted[0]!.categories), sceneTypes: new Set(sorted[0]!.sceneTypes) };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]!;
    const gap = next.start - current.end;
    if (gap <= MERGE_GAP_CHARS && !hasChapterBoundaryBetween(text, current.end, next.start)) {
      current.end = Math.max(current.end, next.end);
      current.score = Math.max(current.score, next.score) + next.score * 0.3;
      current.matchCount += next.matchCount;
      for (const c of next.categories) current.categories.add(c);
      for (const t of next.sceneTypes) current.sceneTypes.add(t);
    } else {
      merged.push(current);
      current = { ...next, categories: new Set(next.categories), sceneTypes: new Set(next.sceneTypes) };
    }
  }
  merged.push(current);

  return merged
    .map((c) => {
      const len = c.end - c.start;
      if (len < MIN_CHUNK_CHARS && c.start > 0) {
        const pad = Math.min(CONTEXT_PAD_CHARS, c.start);
        c.start -= pad;
      }
      if (c.end - c.start < MIN_CHUNK_CHARS) {
        c.end = Math.min(c.start + MIN_CHUNK_CHARS, c.end + CONTEXT_PAD_CHARS);
      }
      if (c.end - c.start > MAX_CHUNK_CHARS) {
        c.end = c.start + MAX_CHUNK_CHARS;
      }
      return c;
    })
    .filter((c) => c.end > c.start);
}

export interface DiscoverMilitaryScenesInput {
  readonly inventoryId: string;
  readonly manuscriptId: string;
  readonly manuscriptVersionId: string;
  readonly workflowId: string | null;
  readonly text: string;
  readonly contentHash: string;
  readonly mode?: "author" | "certification";
}

/** Deterministic scene discovery — provider refinement NOT used in Phase 1. */
export function discoverMilitaryScenes(
  input: DiscoverMilitaryScenesInput,
): MilitaryExpertSceneInventoryDocument {
  const text = input.text;
  const rawCandidates = scanCandidates(text);
  const merged = mergeCandidates(rawCandidates, text);

  const scenes: MilitaryExpertSceneInventoryEntry[] = merged.map((candidate, index) => {
    const sceneIndex = index + 1;
    const sceneId = `ME-S-${String(sceneIndex).padStart(3, "0")}`;
    const start = Math.max(0, candidate.start);
    const end = Math.min(text.length, candidate.end);
    const excerpt = text.slice(start, end);
    const categories = [...candidate.categories];
    const sceneTypes =
      candidate.sceneTypes.size > 0
        ? [...candidate.sceneTypes]
        : (["other"] as MilitaryExpertSceneType[]);
    const priority = classifyPriorityTier(candidate.score, sceneTypes);
    const pct = text.length > 0 ? Math.round((start / text.length) * 100) : 0;
    const chapterLabel = detectChapterLabel(text, start);
    const sceneHeading = detectSceneHeading(text, start, end);

    return Object.freeze({
      inventory_id: input.inventoryId,
      scene_id: sceneId,
      manuscript_id: input.manuscriptId,
      manuscript_version_id: input.manuscriptVersionId,
      scene_index: sceneIndex,
      locator: Object.freeze({
        exact_page_number: null,
        page_is_approximate: false,
        chapter_label: chapterLabel,
        scene_heading: sceneHeading,
        approximate_book_percentage: pct,
        internal_start_offset: start,
        internal_end_offset: end,
      }),
      two_sentence_description: buildTwoSentenceDescription(excerpt, categories),
      scene_types: Object.freeze(sceneTypes),
      action_categories: Object.freeze(categories.length > 0 ? categories : ["firefight_or_battle"]),
      participants: Object.freeze([] as string[]),
      priority_tier: priority,
      discovery_confidence: Math.min(0.95, 0.55 + candidate.matchCount * 0.08 + candidate.score * 0.03),
      discovery_source: "deterministic_heuristic" as const,
      default_selected: priority === "major",
      selection_warning_codes: Object.freeze(
        priority === "major" ? (["major_scene_deselected"] as const) : [],
      ),
      source_hash: excerptHash(excerpt, input.contentHash.slice(0, 16)),
    });
  });

  const majorCount = scenes.filter((s) => s.priority_tier === "major").length;

  return Object.freeze({
    contract_version: MILITARY_EXPERT_SCENE_INVENTORY_CONTRACT_VERSION,
    inventory_id: input.inventoryId,
    manuscript_id: input.manuscriptId,
    manuscript_version_id: input.manuscriptVersionId,
    workflow_id: input.workflowId,
    generated_at: new Date().toISOString(),
    mode: input.mode ?? "author",
    scene_count: scenes.length,
    major_scene_count: majorCount,
    scenes: Object.freeze(scenes),
    inventory_status: "draft",
  });
}

export const DISCOVERY_PROVIDER_USED_IN_PHASE_1 = false;
