import { RECKONING_REVISED_13_SOURCE_PIN } from "@/experts/archivist/reckoning-revised-13-source-pin.ts";
import { ARCHIVIST_RECKONING_RULE8_BENCHMARK_VERSION } from "./types.ts";

export const RULE8_BENCHMARK_IDENTITY = {
  benchmark_version: ARCHIVIST_RECKONING_RULE8_BENCHMARK_VERSION,
  source_review: {
    title: "The Reckoning: Rule 8 Editorial Review (Cold Read)",
    generated: "September 24, 2026, 4:47 PM PT",
    source_filename: "Reckoning_Rule8_Review_2026-09-24.docx",
    target_filename_named_in_review: "HoldFast_BookOne_TheReckoning_REVISED-13-2.docx",
    review_warning:
      "Rule 8 targets REVISED-13-2. Archivist analyzed pinned REVISED-13. Paragraph numbers are navigation hints only.",
  },
  target_manuscript: {
    series_title: RECKONING_REVISED_13_SOURCE_PIN.series_title,
    book_title: RECKONING_REVISED_13_SOURCE_PIN.book_title,
    source_filename: RECKONING_REVISED_13_SOURCE_PIN.source_filename,
    manuscript_id: RECKONING_REVISED_13_SOURCE_PIN.manuscript_id,
    manuscript_version_id: RECKONING_REVISED_13_SOURCE_PIN.manuscript_version_id,
    content_hash: RECKONING_REVISED_13_SOURCE_PIN.content_hash,
    analytical_word_count: RECKONING_REVISED_13_SOURCE_PIN.analytical_word_count,
    workflow_id: "293c23d7-2793-4f79-bb97-5eb3ab8ae7fc",
    persisted_entities: 71,
    persisted_retained_facts: 126,
    persisted_review_findings: 0,
  },
  measurement_only: true,
  provider_calls: 0,
} as const;
