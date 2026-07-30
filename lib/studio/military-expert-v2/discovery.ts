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

const MIN_CHUNK_CHARS = 1_000;
const MAX_CHUNK_CHARS = 14_000;
const MERGE_GAP_CHARS = 3_500;
const CONTEXT_PAD_CHARS = 300;
const SCAN_CHUNK_SIZE = 4_000;
const SCAN_STEP = 2_500;
const MIN_SCORE_THRESHOLD = 3;
const MIN_TACTICAL_SCORE = 2.5;

const TACTICAL_ANCHOR_CATEGORIES: ReadonlySet<MilitaryExpertActionCategory> = new Set([
  "firefight_or_battle",
  "movement_and_cover",
  "room_entry_or_breach",
  "ambush_or_contact",
  "convoy_or_vehicle_movement",
  "casualty_treatment_or_evacuation",
  "aviation",
]);

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
      /\b(?:firefight|fire fight|gunfight|gun fight|exchange of fire|sustained fire|incoming fire|return fire|suppressing fire|troops in contact|contact!)\b/i,
      /\b(?:muzzle flash|tracer|rounds? (?:snapped|cracked|whizzed)|bullets? (?:punched|tore|ripped)|automatic fire|rifle fire)\b/i,
      /\b(?:took (?:cover|fire)|opened fire|laid down fire|covering fire)\b/i,
    ],
    weight: 3,
  },
  {
    category: "movement_and_cover",
    sceneTypes: ["firefight"],
    patterns: [
      /\b(?:bound(?:ing)?|cover and move|move to cover|low crawl|sprint to|dash(?:ed|ing)? to cover|suppressive fire while)\b/i,
      /\b(?:behind (?:the )?(?:wall|barrier|vehicle|concrete|sandbag|humvee|MRAP))\b/i,
      /\b(?:peel(?:ing)? back|break contact|withdraw under fire)\b/i,
    ],
    weight: 2,
  },
  {
    category: "room_entry_or_breach",
    sceneTypes: ["breach", "room_entry"],
    patterns: [
      /\b(?:breach(?:ing|ed)?|dynamic entry|stack(?:ed|ing)? on the door|room clear|clear the room|kick(?:ed|ing)? (?:in )?the door|flash[- ]?bang|door charge|fatal funnel)\b/i,
      /\b(?:entry team|point man|second man|threshold|corner fed)\b/i,
    ],
    weight: 3,
  },
  {
    category: "ambush_or_contact",
    sceneTypes: ["firefight", "battle"],
    patterns: [
      /\b(?:ambush(?:ed|ing)?|IED|improvised explosive|sniper|contact (?:left|right|front|rear)|sudden (?:attack|gunfire|explosion|detonation))\b/i,
      /\b(?:initiated contact|enemy contact|troops in contact)\b/i,
    ],
    weight: 3,
  },
  {
    category: "convoy_or_vehicle_movement",
    sceneTypes: ["convoy", "vehicle_contact"],
    patterns: [
      /\b(?:convoy|MRAP|humvee|vehicle patrol|roadside|checkpoint|motorcade|turret|gunner(?:'s)? (?:seat|position))\b/i,
      /\b(?:mounted patrol|gun truck|lead vehicle|trail vehicle)\b/i,
    ],
    weight: 2.5,
  },
  {
    category: "command_decision",
    sceneTypes: ["command_decision"],
    patterns: [
      /\b(?:command(?:er's)? intent|ROE|rules of engagement|mission brief|execute the plan|on my command|six(?:'s)? (?:call|order))\b/i,
      /\b(?:fragmentation order|commander's estimate|decision point)\b/i,
    ],
    weight: 1.5,
  },
  {
    category: "radio_or_communications",
    sceneTypes: ["communications"],
    patterns: [
      /\b(?:radio|comms|over(?: the)? net|push[- ]?to[- ]?talk|satcom|frequency|call sign|broken arrow|sitrep|nine[- ]?line)\b/i,
    ],
    weight: 1.25,
  },
  {
    category: "weapons_handling",
    sceneTypes: ["weapons_handling"],
    patterns: [
      /\b(?:mag(?:azine)? change|reload(?:ed|ing)?|safety off|chamber(?:ed|ing)?|weapon(?:s)? (?:up|ready|hot))\b/i,
      /\b(?:rifle|carbine|sidearm|pistol|SAW|240|249|AT4|grenade launcher)\b/i,
    ],
    weight: 1.25,
  },
  {
    category: "casualty_treatment_or_evacuation",
    sceneTypes: ["casualty_under_fire", "casualty_evacuation"],
    patterns: [
      /\b(?:casualty|wounded|tourniquet|medevac|MEDEVAC|CASEVAC|triage|pressure dressing|bleeding out|KIA|WIA|evac(?:uate)?(?:d|ing)? (?:the )?(?:wounded|casualty))\b/i,
      /\b(?:nine[- ]?line medevac|dustoff|bird (?:inbound|on station))\b/i,
    ],
    weight: 3,
  },
  {
    category: "intelligence_or_planning",
    sceneTypes: ["mission_planning", "intelligence"],
    patterns: [
      /\b(?:mission plan|target package|HVT|recon patrol|surveillance op|SIGINT|HUMINT|objective rally point)\b/i,
      /\b(?:operations order|WARNO|FRAGO|scheme of maneuver|concept of the operation)\b/i,
    ],
    weight: 1,
  },
  {
    category: "aviation",
    sceneTypes: ["aviation_insertion", "aviation_extraction"],
    patterns: [
      /\b(?:helo|helicopter|black hawk|chinook|fast rope|fast[- ]?rope|insert(?:ion)?|exfil|extraction|LZ|landing zone|rotor wash|door gunner)\b/i,
      /\b(?:QRF|air assault|airmobile|hot LZ|cold LZ)\b/i,
    ],
    weight: 3,
  },
  {
    category: "military_culture_or_chain_of_command",
    sceneTypes: ["military_culture", "chain_of_command"],
    patterns: [
      /\b(?:salute|NCO|officer|chain of command|rank insignia|court[- ]?martial|Article 15)\b/i,
      /\b(?:barracks|PT formation|military police|drill sergeant)\b/i,
    ],
    weight: 0.75,
  },
];

interface RawCandidate {
  start: number;
  end: number;
  score: number;
  tacticalScore: number;
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
  const windowStart = Math.max(0, offset - 3000);
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

function scoreSlice(slice: string): Omit<RawCandidate, "start" | "end"> {
  let score = 0;
  let tacticalScore = 0;
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
        if (TACTICAL_ANCHOR_CATEGORIES.has(signal.category)) {
          tacticalScore += signal.weight;
        }
        break;
      }
    }
  }

  return { score, tacticalScore, categories, sceneTypes, matchCount };
}

function classifyPriorityTier(
  candidate: RawCandidate,
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
  const tacticalAnchors = [...candidate.categories].filter((c) =>
    TACTICAL_ANCHOR_CATEGORIES.has(c),
  ).length;

  if (candidate.tacticalScore >= 5 || (hasMajorType && candidate.tacticalScore >= 3.5)) {
    return "major";
  }
  if (candidate.tacticalScore >= 2.5 || (hasMajorType && candidate.score >= 4)) {
    return "moderate";
  }
  if (hasMajorType) return "moderate";
  return "minor";
}

function buildTwoSentenceDescription(
  excerpt: string,
  categories: readonly MilitaryExpertActionCategory[],
): string {
  const normalized = normalizeWhitespace(excerpt).slice(0, 400);
  const tactical = categories.filter((c) => TACTICAL_ANCHOR_CATEGORIES.has(c));
  const categoryLabel = (tactical[0] ?? categories[0] ?? "military action").replace(/_/g, " ");
  const first =
    normalized.length > 20
      ? `${normalized.slice(0, 180).trim()}${normalized.length > 180 ? "…" : ""}`
      : `A sequence involving ${categoryLabel} appears in this section of the manuscript.`;
  const second = `The scene emphasizes ${(tactical.length > 0 ? tactical : categories).slice(0, 3).join(", ").replace(/_/g, " ")} and related tactical elements.`;
  return `${first} ${second}`;
}

function hasChapterBoundaryBetween(text: string, end: number, nextStart: number): boolean {
  const between = text.slice(end, nextStart);
  return /(?:^|\n)\s*Chapter\s+\d+/i.test(between);
}

function isSubstantialCandidate(candidate: RawCandidate): boolean {
  const hasTacticalAnchor = [...candidate.categories].some((c) => TACTICAL_ANCHOR_CATEGORIES.has(c));
  if (!hasTacticalAnchor) return false;
  if (candidate.tacticalScore >= MIN_TACTICAL_SCORE) return true;
  return candidate.score >= MIN_SCORE_THRESHOLD + 2 && candidate.matchCount >= 3;
}

function scanCandidates(text: string): RawCandidate[] {
  const candidates: RawCandidate[] = [];

  for (let start = 0; start < text.length; start += SCAN_STEP) {
    const end = Math.min(text.length, start + SCAN_CHUNK_SIZE);
    const scored = scoreSlice(text.slice(start, end));
    if (scored.tacticalScore >= MIN_TACTICAL_SCORE || scored.score >= MIN_SCORE_THRESHOLD + 1) {
      candidates.push({ start, end, ...scored });
    }
  }

  return candidates;
}

function mergeCandidates(candidates: readonly RawCandidate[], text: string): RawCandidate[] {
  if (candidates.length === 0) return [];
  const sorted = [...candidates].sort((a, b) => a.start - b.start);
  const merged: RawCandidate[] = [];
  let current = {
    ...sorted[0]!,
    categories: new Set(sorted[0]!.categories),
    sceneTypes: new Set(sorted[0]!.sceneTypes),
  };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]!;
    const gap = next.start - current.end;
    if (gap <= MERGE_GAP_CHARS && !hasChapterBoundaryBetween(text, current.end, next.start)) {
      current.end = Math.max(current.end, next.end);
      current.score = Math.max(current.score, next.score) + next.score * 0.25;
      current.tacticalScore = Math.max(current.tacticalScore, next.tacticalScore) + next.tacticalScore * 0.25;
      current.matchCount += next.matchCount;
      for (const c of next.categories) current.categories.add(c);
      for (const t of next.sceneTypes) current.sceneTypes.add(t);
    } else {
      merged.push(current);
      current = {
        ...next,
        categories: new Set(next.categories),
        sceneTypes: new Set(next.sceneTypes),
      };
    }
  }
  merged.push(current);

  return merged
    .filter(isSubstantialCandidate)
    .map((c) => {
      const len = c.end - c.start;
      if (len < MIN_CHUNK_CHARS && c.start > 0) {
        c.start = Math.max(0, c.start - CONTEXT_PAD_CHARS);
      }
      if (c.end - c.start < MIN_CHUNK_CHARS) {
        c.end = Math.min(c.start + MIN_CHUNK_CHARS, text.length);
      }
      if (c.end - c.start > MAX_CHUNK_CHARS) {
        c.end = c.start + MAX_CHUNK_CHARS;
      }
      return c;
    })
    .filter((c) => c.end > c.start);
}

function consolidateByBookPercentage(
  candidates: readonly RawCandidate[],
  textLength: number,
): RawCandidate[] {
  if (candidates.length <= 1) return [...candidates];
  const sorted = [...candidates].sort((a, b) => a.start - b.start);
  const consolidated: RawCandidate[] = [];
  let current = {
    ...sorted[0]!,
    categories: new Set(sorted[0]!.categories),
    sceneTypes: new Set(sorted[0]!.sceneTypes),
  };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]!;
    const currentPct = (current.start / textLength) * 100;
    const nextPct = (next.start / textLength) * 100;
    const shared = [...next.categories].filter((c) => current.categories.has(c)).length;
    const closePct = Math.abs(nextPct - currentPct) <= 5;
    const closeChars = next.start - current.end <= MERGE_GAP_CHARS;

    if (closePct && closeChars && shared >= 1) {
      current.end = Math.max(current.end, next.end);
      current.score = Math.max(current.score, next.score) + next.score * 0.2;
      current.tacticalScore = Math.max(current.tacticalScore, next.tacticalScore) + next.tacticalScore * 0.2;
      current.matchCount += next.matchCount;
      for (const c of next.categories) current.categories.add(c);
      for (const t of next.sceneTypes) current.sceneTypes.add(t);
    } else {
      consolidated.push(current);
      current = {
        ...next,
        categories: new Set(next.categories),
        sceneTypes: new Set(next.sceneTypes),
      };
    }
  }
  consolidated.push(current);
  return consolidated;
}

function overlapsExisting(candidate: RawCandidate, existing: readonly RawCandidate[]): boolean {
  for (const scene of existing) {
    const overlapStart = Math.max(candidate.start, scene.start);
    const overlapEnd = Math.min(candidate.end, scene.end);
    if (overlapEnd <= overlapStart) continue;
    const overlapLen = overlapEnd - overlapStart;
    const candidateLen = candidate.end - candidate.start;
    if (overlapLen / candidateLen >= 0.45) return true;
  }
  return false;
}

/** Secondary pass: recover substantial tactical clusters missed by merge/consolidation. */
function discoverOrphanClusters(
  text: string,
  existing: readonly RawCandidate[],
): RawCandidate[] {
  const orphans: RawCandidate[] = [];
  const window = 3_500;
  const step = Math.max(1_800, Math.floor(text.length / 40));

  for (let start = 0; start < text.length; start += step) {
    const end = Math.min(text.length, start + window);
    const scored = scoreSlice(text.slice(start, end));
    if (scored.tacticalScore < 3.5) continue;
    const candidate: RawCandidate = { start, end, ...scored };
    if (!isSubstantialCandidate(candidate)) continue;
    if (overlapsExisting(candidate, existing)) continue;
    orphans.push(candidate);
  }

  return orphans;
}

function filterPrologueFalsePositive(
  candidates: readonly RawCandidate[],
  textLength: number,
): RawCandidate[] {
  return candidates.filter((c) => {
    const pct = (c.start / textLength) * 100;
    if (pct > 3) return true;
    const tacticalAnchors = [...c.categories].filter((cat) => TACTICAL_ANCHOR_CATEGORIES.has(cat)).length;
    return c.tacticalScore >= 4 && tacticalAnchors >= 2;
  });
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
  let merged = consolidateByBookPercentage(mergeCandidates(rawCandidates, text), text.length);
  const orphans = discoverOrphanClusters(text, merged);
  if (orphans.length > 0) {
    merged = consolidateByBookPercentage([...merged, ...orphans], text.length);
  }
  merged = filterPrologueFalsePositive(merged, text.length);

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
    const priority = classifyPriorityTier(candidate, sceneTypes);
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
      discovery_confidence: Math.min(
        0.95,
        0.52 + candidate.matchCount * 0.06 + candidate.tacticalScore * 0.04,
      ),
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
