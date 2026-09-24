import { countManuscriptWords } from "@/lib/word-count.ts";
import { ARCHIVIST_FIXTURE_ENTITY_IDS } from "../entity-catalog.ts";
import { storyDnaContentHash } from "./manuscript-loader.ts";
import { emptySegmentObservation } from "./observation-contract.ts";
import type {
  ArchivistSegmentObservation,
  PinnedManuscriptSnapshot,
  SegmentObservationFact,
} from "./types.ts";

export const SIM_MANUSCRIPT_ID = "sim-ms-segmented-architecture";
export const SIM_MANUSCRIPT_VERSION_ID = "sim-mv-segmented-architecture";

const CHAPTER_HEADINGS = [
  "PROLOGUE",
  ...Array.from({ length: 29 }, (_, index) => {
    const names = [
      "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN",
      "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN",
      "EIGHTEEN", "NINETEEN", "TWENTY", "TWENTY-ONE", "TWENTY-TWO", "TWENTY-THREE",
      "TWENTY-FOUR", "TWENTY-FIVE", "TWENTY-SIX", "TWENTY-SEVEN", "TWENTY-EIGHT",
      "TWENTY-NINE",
    ];
    return `CHAPTER ${names[index]}`;
  }),
];

const PLANTED = {
  prologueEyes: "Mara had blue eyes that caught the lantern light.",
  chapter02Usage: "Mara whispered the courier password at the gate.",
  chapter04Learn: "Mara learned the courier password at dusk.",
  chapter07CompassMara: "The silver compass sat in Mara's coat pocket.",
  chapter11Left: "The wound on Mara's left shoulder had closed.",
  chapter11Right: "The medic wrapped Mara's right shoulder.",
  chapter22CompassCalder: "Calder spun the silver compass on the chart table.",
  chapter29Eyes: "Mara's green eyes narrowed at the map.",
} as const;

function fillerWords(count: number, seed: string): string {
  const words = Array.from({ length: count }, (_, index) => `${seed}${index}`);
  const paragraphs: string[] = [];
  for (let i = 0; i < words.length; i += 80) {
    paragraphs.push(words.slice(i, i + 80).join(" "));
  }
  return paragraphs.join("\n\n");
}

function unitBody(heading: string, index: number, extraWords: number): string {
  const extras: string[] = [];
  if (index === 0) extras.push(PLANTED.prologueEyes);
  if (index === 2) extras.push(PLANTED.chapter02Usage);
  if (index === 4) extras.push(PLANTED.chapter04Learn);
  if (index === 7) extras.push(PLANTED.chapter07CompassMara);
  if (index === 11) extras.push(PLANTED.chapter11Left, PLANTED.chapter11Right);
  if (index === 22) extras.push(PLANTED.chapter22CompassCalder);
  if (index === 29) extras.push(PLANTED.chapter29Eyes);
  extras.push(`${heading} continues with ${seedPhrase(index)}.`);
  extras.push(fillerWords(extraWords, `u${index}w`));
  return extras.join(" ");
}

function seedPhrase(index: number): string {
  return `stable narrative body for unit ${index}`;
}

export function buildSyntheticThirtyUnitManuscript(args?: {
  wordsPerUnit?: number;
  oversizedChapter?: number;
  oversizedWords?: number;
}): { text: string; snapshot: PinnedManuscriptSnapshot } {
  const wordsPerUnit = args?.wordsPerUnit ?? 900;
  const parts = CHAPTER_HEADINGS.map((heading, index) => {
    const extra =
      args?.oversizedChapter === index
        ? (args.oversizedWords ?? 15_000)
        : wordsPerUnit;
    return `${heading}\n\n${unitBody(heading, index, extra)}\n\n`;
  });
  const text = parts.join("");
  const snapshot: PinnedManuscriptSnapshot = {
    manuscript_id: SIM_MANUSCRIPT_ID,
    manuscript_version_id: SIM_MANUSCRIPT_VERSION_ID,
    version_number: 1,
    is_current: true,
    content_hash: storyDnaContentHash(text),
    source_filename: "synthetic-thirty-unit.txt",
    source_docx_sha256: "b".repeat(64),
    analytical_word_count: countManuscriptWords(text),
    extracted_text: text,
  };
  return { text, snapshot };
}

function fact(args: {
  id: string;
  alias: string;
  fact_type: SegmentObservationFact["fact_type"];
  value: Record<string, unknown>;
  chapter: string;
  excerpt: string;
  entity_type?: SegmentObservationFact["entity_type"];
}): SegmentObservationFact {
  return {
    id: args.id,
    alias: args.alias,
    entity_type: args.entity_type ?? "person",
    fact_type: args.fact_type,
    value: args.value,
    temporal_scope: { kind: "at", book_order: 1, chapter: args.chapter },
    locator: { locator: args.chapter, chapter: args.chapter, book_order: 1 },
    excerpt: args.excerpt,
    confidence: "high",
    inferred: false,
  };
}

export function mockObservationForSegment(args: {
  segmentId: string;
  primaryHeadings: string[];
}): ArchivistSegmentObservation {
  const observation = emptySegmentObservation(args.segmentId);
  observation.entities = [
    { alias: "Mara", entity_type: "person", local_mentions: ["Mara"] },
    { alias: "Calder", entity_type: "person", local_mentions: ["Calder"] },
    { alias: "John", entity_type: "person", local_mentions: ["John"] },
    { alias: "silver compass", entity_type: "object", local_mentions: ["silver compass"] },
  ];
  const headings = new Set(args.primaryHeadings);
  if (headings.has("PROLOGUE")) {
    observation.appearance.push(
      fact({
        id: "fact-eyes-blue",
        alias: "Mara",
        fact_type: "appearance",
        value: { eye_color: "blue" },
        chapter: "PROLOGUE",
        excerpt: PLANTED.prologueEyes,
      }),
    );
  }
  if (headings.has("CHAPTER TWO")) {
    observation.knowledge.push(
      fact({
        id: "fact-password-use",
        alias: "Mara",
        fact_type: "knowledge_state",
        value: { kind: "usage", secret: "courier password" },
        chapter: "CHAPTER TWO",
        excerpt: PLANTED.chapter02Usage,
      }),
    );
  }
  if (headings.has("CHAPTER FOUR")) {
    observation.knowledge.push(
      fact({
        id: "fact-password-learn",
        alias: "Mara",
        fact_type: "knowledge_state",
        value: { kind: "acquisition", secret: "courier password" },
        chapter: "CHAPTER FOUR",
        excerpt: PLANTED.chapter04Learn,
      }),
    );
  }
  if (headings.has("CHAPTER SEVEN")) {
    observation.unique_objects.push(
      fact({
        id: "fact-compass-mara",
        alias: "silver compass",
        entity_type: "object",
        fact_type: "possession",
        value: { unique: true, possessor: "Mara" },
        chapter: "CHAPTER SEVEN",
        excerpt: PLANTED.chapter07CompassMara,
      }),
    );
  }
  if (headings.has("CHAPTER ELEVEN")) {
    observation.injuries.push(
      fact({
        id: "fact-injury-left",
        alias: "Mara",
        fact_type: "injury",
        value: { laterality: "left", site: "shoulder" },
        chapter: "CHAPTER ELEVEN",
        excerpt: PLANTED.chapter11Left,
      }),
      fact({
        id: "fact-injury-right",
        alias: "Mara",
        fact_type: "injury",
        value: { laterality: "right", site: "shoulder" },
        chapter: "CHAPTER ELEVEN",
        excerpt: PLANTED.chapter11Right,
      }),
    );
  }
  if (headings.has("CHAPTER TWENTY-TWO")) {
    observation.unique_objects.push(
      fact({
        id: "fact-compass-calder",
        alias: "silver compass",
        entity_type: "object",
        fact_type: "possession",
        value: { unique: true, possessor: "Calder" },
        chapter: "CHAPTER TWENTY-TWO",
        excerpt: PLANTED.chapter22CompassCalder,
      }),
    );
  }
  if (headings.has("CHAPTER TWENTY-NINE")) {
    observation.appearance.push(
      fact({
        id: "fact-eyes-green",
        alias: "Mara",
        fact_type: "appearance",
        value: { eye_color: "green" },
        chapter: "CHAPTER TWENTY-NINE",
        excerpt: PLANTED.chapter29Eyes,
      }),
    );
  }
  if (headings.has("CHAPTER ONE") || headings.has("CHAPTER TWENTY-EIGHT")) {
    observation.entities.push({
      alias: "John",
      entity_type: "person",
      local_mentions: ["John"],
    });
    observation.entity_ambiguities.push({
      id: `amb-john-${args.segmentId}`,
      alias: "John",
      candidate_entities: [
        {
          entity_id: ARCHIVIST_FIXTURE_ENTITY_IDS.johnReeves,
          canonical_name: "John Reeves",
          entity_type: "person",
          evidence: [],
        },
        {
          entity_id: ARCHIVIST_FIXTURE_ENTITY_IDS.johnHale,
          canonical_name: "John Hale",
          entity_type: "person",
          evidence: [],
        },
      ],
      context: "shared first name across distant chapters",
      confidence: "medium",
      recommended_author_verification: "Identify which John is present.",
    });
  }
  observation.rank_title.push(
    fact({
      id: `fact-rank-${args.segmentId}`,
      alias: "Mara",
      fact_type: "rank_title",
      value: headings.has("CHAPTER TWENTY-NINE")
        ? { title: "captain" }
        : { title: "lieutenant" },
      chapter: args.primaryHeadings[0] ?? "PROLOGUE",
      excerpt: headings.has("CHAPTER TWENTY-NINE")
        ? PLANTED.chapter29Eyes
        : PLANTED.prologueEyes,
    }),
  );
  return observation;
}

export { PLANTED as SYNTHETIC_PLANTED_EXCERPTS };
