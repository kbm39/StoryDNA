/**
 * Deterministic rehearsal observations.
 * Uses real manuscript excerpts so evidence can rehydrate.
 * Planted values are fixtures, not accepted Hold Fast canon.
 */

import { emptySegmentObservation } from "./observation-contract.ts";
import type {
  ArchivistSegmentObservation,
  PlannedSegment,
  SegmentObservationFact,
  StructuralManuscriptUnit,
} from "./types.ts";

function excerptFromRange(text: string, start: number, end: number): string {
  const slice = text.slice(start, end);
  const newline = slice.indexOf("\n");
  const body =
    newline >= 0
      ? slice.slice(newline + 1)
      : slice.replace(/^(PROLOGUE|CHAPTER [A-Z0-9-]+)\s*/i, "");
  const collapsed = body.replace(/\s+/g, " ").trim();
  return collapsed.split(/\s+/).filter(Boolean).slice(0, 18).join(" ");
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

export function rehearsalObservationForSegment(args: {
  segment: PlannedSegment;
  units: readonly StructuralManuscriptUnit[];
  text: string;
}): ArchivistSegmentObservation {
  const observation = emptySegmentObservation(args.segment.segment_id);
  observation.entities = [
    { alias: "Mara", entity_type: "person", local_mentions: ["Mara"] },
    { alias: "Calder", entity_type: "person", local_mentions: ["Calder"] },
    { alias: "silver compass", entity_type: "object", local_mentions: ["silver compass"] },
  ];
  const headings = new Set(
    args.segment.assignments.filter((item) => item.role === "primary").map((item) => item.heading),
  );
  const unitByHeading = new Map(args.units.map((unit) => [unit.heading, unit]));
  const excerptFor = (heading: string) => {
    const unit = unitByHeading.get(heading);
    if (!unit) return heading;
    return excerptFromRange(args.text, unit.start_offset, unit.end_offset);
  };

  if (headings.has("PROLOGUE")) {
    observation.appearance.push(
      fact({
        id: "rehearsal-eyes-blue",
        alias: "Mara",
        fact_type: "appearance",
        value: { eye_color: "blue" },
        chapter: "PROLOGUE",
        excerpt: excerptFor("PROLOGUE"),
      }),
    );
  }
  if (headings.has("CHAPTER TWO")) {
    observation.knowledge.push(
      fact({
        id: "rehearsal-password-use",
        alias: "Mara",
        fact_type: "knowledge_state",
        value: { kind: "usage", secret: "courier password" },
        chapter: "CHAPTER TWO",
        excerpt: excerptFor("CHAPTER TWO"),
      }),
    );
  }
  if (headings.has("CHAPTER FOUR")) {
    observation.knowledge.push(
      fact({
        id: "rehearsal-password-learn",
        alias: "Mara",
        fact_type: "knowledge_state",
        value: { kind: "acquisition", secret: "courier password" },
        chapter: "CHAPTER FOUR",
        excerpt: excerptFor("CHAPTER FOUR"),
      }),
    );
  }
  if (headings.has("CHAPTER SEVEN")) {
    observation.unique_objects.push(
      fact({
        id: "rehearsal-compass-mara",
        alias: "silver compass",
        entity_type: "object",
        fact_type: "possession",
        value: { unique: true, possessor: "Mara" },
        chapter: "CHAPTER SEVEN",
        excerpt: excerptFor("CHAPTER SEVEN"),
      }),
    );
  }
  if (headings.has("CHAPTER ELEVEN")) {
    observation.injuries.push(
      fact({
        id: "rehearsal-injury-left",
        alias: "Mara",
        fact_type: "injury",
        value: { laterality: "left", site: "shoulder" },
        chapter: "CHAPTER ELEVEN",
        excerpt: excerptFor("CHAPTER ELEVEN"),
      }),
      fact({
        id: "rehearsal-injury-right",
        alias: "Mara",
        fact_type: "injury",
        value: { laterality: "right", site: "shoulder" },
        chapter: "CHAPTER ELEVEN",
        excerpt: excerptFor("CHAPTER ELEVEN"),
      }),
    );
  }
  if (headings.has("CHAPTER TWENTY-TWO")) {
    observation.unique_objects.push(
      fact({
        id: "rehearsal-compass-calder",
        alias: "silver compass",
        entity_type: "object",
        fact_type: "possession",
        value: { unique: true, possessor: "Calder" },
        chapter: "CHAPTER TWENTY-TWO",
        excerpt: excerptFor("CHAPTER TWENTY-TWO"),
      }),
    );
  }
  if (headings.has("CHAPTER TWENTY-NINE")) {
    observation.appearance.push(
      fact({
        id: "rehearsal-eyes-green",
        alias: "Mara",
        fact_type: "appearance",
        value: { eye_color: "green" },
        chapter: "CHAPTER TWENTY-NINE",
        excerpt: excerptFor("CHAPTER TWENTY-NINE"),
      }),
    );
  }
  return observation;
}
