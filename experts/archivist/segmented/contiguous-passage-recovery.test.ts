import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { manuscriptPassageLocated } from "@/lib/passage-locate.ts";
import { validateArchivistReview } from "../validation.ts";
import { mergeSegmentObservations } from "./book-graph.ts";
import { recoverContiguousManuscriptPassage } from "./contiguous-passage-recovery.ts";
import { pairDeterministicContradictions } from "./contradiction-pairing.ts";
import { buildCoverageReport } from "./coverage.ts";
import { assembleSegmentedArchivistReview } from "./final-assembly.ts";
import {
  buildSyntheticThirtyUnitManuscript,
  mockObservationForSegment,
  SYNTHETIC_PLANTED_EXCERPTS,
} from "./fixtures.ts";
import { planSegments } from "./segment-planner.ts";
import { createPendingCheckpoints, markCheckpointValidated } from "./checkpoint.ts";

const MANUSCRIPT = [
  "PROLOGUE",
  "",
  "Mara had blue eyes that caught the lantern light.",
  "",
  "CHAPTER ONE",
  "",
  "The silver compass sat in Mara's coat pocket near the hatch.",
  "Later the silver compass sat on the chart table again.",
  "",
  "CHAPTER TWO",
  "",
  "Mara's green eyes narrowed at the map.",
].join("\n");

describe("contiguous passage recovery", () => {
  it("does not treat a paraphrased excerpt as manuscript evidence", () => {
    const paraphrase = "Mara lingered near the entrance with striking azure irises.";
    assert.equal(manuscriptPassageLocated(MANUSCRIPT, paraphrase), false);
    const recovered = recoverContiguousManuscriptPassage({
      excerpt: paraphrase,
      locator: "PROLOGUE",
      manuscriptText: MANUSCRIPT,
      value: { eye_color: "blue" },
    });
    assert.equal(recovered.class, "C");
    assert.equal(recovered.excerpt, paraphrase);
    assert.equal(recovered.fabricated, false);
    assert.equal(manuscriptPassageLocated(MANUSCRIPT, recovered.excerpt), false);
  });

  it("recovers a unique contiguous passage from locator provenance", () => {
    const recovered = recoverContiguousManuscriptPassage({
      excerpt: "Mara had blue eyes that caught lantern light near dusk",
      locator: "PROLOGUE",
      manuscriptText: MANUSCRIPT,
      value: { eye_color: "blue" },
    });
    assert.equal(recovered.class, "B");
    assert.equal(recovered.located, true);
    assert.equal(manuscriptPassageLocated(MANUSCRIPT, recovered.excerpt), true);
    assert.match(recovered.excerpt, /Mara had blue eyes that caught the lantern light/);
  });

  it("fails closed when more than one passage could be selected", () => {
    const recovered = recoverContiguousManuscriptPassage({
      excerpt: "the silver compass sat somewhere nearby",
      locator: "CHAPTER ONE",
      manuscriptText: MANUSCRIPT,
      value: { possessor: "Mara" },
    });
    assert.equal(recovered.class, "C");
    assert.equal(recovered.located, false);
    assert.match(recovered.reason, /multiple unique fragments|no unique contiguous fragment/);
  });

  it("requires the recovered passage to support the same observation", () => {
    const recovered = recoverContiguousManuscriptPassage({
      excerpt: "Mara had blue eyes that caught lantern light",
      locator: "PROLOGUE",
      manuscriptText: MANUSCRIPT,
      value: { eye_color: "blue" },
    });
    assert.equal(recovered.class, "B");
    assert.match(recovered.excerpt.toLowerCase(), /blue/);
  });

  it("does not fabricate a quotation when nothing contiguous exists", () => {
    const invented = "Kevin invented this purple-hair quotation about Mara.";
    const recovered = recoverContiguousManuscriptPassage({
      excerpt: invented,
      locator: "PROLOGUE",
      manuscriptText: MANUSCRIPT,
      value: { hair: "purple" },
    });
    assert.equal(recovered.class, "C");
    assert.equal(recovered.excerpt, invented);
    assert.equal(recovered.fabricated, false);
    assert.equal(manuscriptPassageLocated(MANUSCRIPT, invented), false);
  });
});

describe("zero-dollar review assembly from preserved graph", () => {
  it("downgrades one-sided and unrecoverable confirmed findings", () => {
    const { text, snapshot } = buildSyntheticThirtyUnitManuscript({ wordsPerUnit: 200 });
    const plan = planSegments(text, snapshot);
    const coverage = buildCoverageReport({
      text,
      plan,
      canonicalWordCount: snapshot.analytical_word_count,
    });
    assert.equal(coverage.complete, true);
    assert.equal(coverage.coverage_percentage, 100);

    const checkpoints = createPendingCheckpoints(plan).map((checkpoint) => {
      const segment = plan.segments.find((item) => item.segment_id === checkpoint.segment_id)!;
      const observation = mockObservationForSegment({
        segmentId: checkpoint.segment_id,
        primaryHeadings: segment.assignments
          .filter((item) => item.role === "primary")
          .map((item) => item.heading),
      });
      const green = observation.appearance.find((fact) => fact.id === "fact-eyes-green");
      if (green) {
        green.excerpt = "Kevin invented a green-eyed paraphrase with no manuscript overlap.";
      }
      return markCheckpointValidated(checkpoint, observation, false);
    });
    const graph = mergeSegmentObservations({
      manuscript_id: snapshot.manuscript_id,
      manuscript_version_id: snapshot.manuscript_version_id,
      content_hash: snapshot.content_hash,
      checkpoints,
    });
    const pairs = pairDeterministicContradictions(graph);
    const review = assembleSegmentedArchivistReview({
      coverage,
      graph,
      pairs,
      manuscriptText: text,
      manuscript_id: snapshot.manuscript_id,
      manuscript_version_id: snapshot.manuscript_version_id,
      content_hash: snapshot.content_hash,
    });
    const validation = validateArchivistReview(review, { manuscriptText: text });
    assert.equal(validation.ok, true, validation.errors.join("; "));
    const eyes = review.findings.filter((finding) => finding.issue_type === "appearance");
    assert.ok(eyes.length >= 1);
    for (const finding of eyes) {
      assert.notEqual(finding.classification, "confirmed_contradiction");
      assert.notEqual(finding.final_classification, "confirmed_contradiction");
    }
    assert.equal(review.canon_delta.every((delta) => delta.status === "candidate"), true);
    assert.equal(coverage.unique_words_covered, snapshot.analytical_word_count);
  });

  it("assembles a full candidate-only review from preserved checkpoints and BookGraph", () => {
    const { text, snapshot } = buildSyntheticThirtyUnitManuscript({ wordsPerUnit: 200 });
    const plan = planSegments(text, snapshot);
    const coverage = buildCoverageReport({
      text,
      plan,
      canonicalWordCount: snapshot.analytical_word_count,
    });
    const checkpoints = createPendingCheckpoints(plan).map((checkpoint) => {
      const segment = plan.segments.find((item) => item.segment_id === checkpoint.segment_id)!;
      const observation = mockObservationForSegment({
        segmentId: checkpoint.segment_id,
        primaryHeadings: segment.assignments
          .filter((item) => item.role === "primary")
          .map((item) => item.heading),
      });
      const blue = observation.appearance.find((fact) => fact.id === "fact-eyes-blue");
      if (blue) {
        blue.excerpt = "Mara had blue eyes that caught lantern light near dusk";
      }
      return markCheckpointValidated(checkpoint, observation, false);
    });
    const graph = mergeSegmentObservations({
      manuscript_id: snapshot.manuscript_id,
      manuscript_version_id: snapshot.manuscript_version_id,
      content_hash: snapshot.content_hash,
      checkpoints,
    });
    const pairs = pairDeterministicContradictions(graph);
    const review = assembleSegmentedArchivistReview({
      coverage,
      graph,
      pairs,
      manuscriptText: text,
      manuscript_id: snapshot.manuscript_id,
      manuscript_version_id: snapshot.manuscript_version_id,
      content_hash: snapshot.content_hash,
    });
    const validation = validateArchivistReview(review, { manuscriptText: text });
    assert.equal(validation.ok, true, validation.errors.join("; "));
    assert.equal(coverage.complete, true);
    assert.equal(coverage.coverage_percentage, 100);
    assert.equal(review.canon_delta.every((delta) => delta.status === "candidate"), true);
    assert.equal(review.canon_delta.some((delta) => (delta.status as string) === "accepted"), false);
    const confirmed = review.findings.filter(
      (finding) => finding.final_classification === "confirmed_contradiction",
    );
    for (const finding of confirmed) {
      assert.ok(finding.current_evidence.every((record) =>
        manuscriptPassageLocated(text, record.excerpt),
      ));
      assert.ok(finding.conflicting_evidence.every((record) =>
        manuscriptPassageLocated(text, record.excerpt),
      ));
    }
    assert.ok(
      graph.candidate_facts.some((fact) =>
        fact.evidence[0]?.excerpt === "Mara had blue eyes that caught lantern light near dusk" ||
        manuscriptPassageLocated(text, SYNTHETIC_PLANTED_EXCERPTS.prologueEyes),
      ),
    );
  });
});
