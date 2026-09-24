/**
 * HOLD FAST live Archivist pilot plan.
 * Do not upload, link, run, or auto-accept canon in this phase.
 */

export const HOLD_FAST_SERIES_TITLE = "Hold Fast" as const;

export const HOLD_FAST_BOOK_1_TITLE = "The Reckoning" as const;

export const HOLD_FAST_BOOK_2_TITLE = "No Mercy" as const;

export const HOLD_FAST_PILOT_BOOKS = [
  {
    series_order: 1,
    title: HOLD_FAST_BOOK_1_TITLE,
    series_title: HOLD_FAST_SERIES_TITLE,
    linked: false,
    uploaded: false,
    archivist_run: false,
  },
  {
    series_order: 2,
    title: HOLD_FAST_BOOK_2_TITLE,
    series_title: HOLD_FAST_SERIES_TITLE,
    linked: false,
    uploaded: false,
    archivist_run: false,
  },
] as const;

export const HOLD_FAST_PILOT_SEQUENCE = [
  {
    id: "A",
    action: "run_archivist",
    book: HOLD_FAST_BOOK_1_TITLE,
    automated_author_acceptance: false,
  },
  {
    id: "B",
    action: "review_candidate_canon",
    book: HOLD_FAST_BOOK_1_TITLE,
    automated_author_acceptance: false,
  },
  {
    id: "C",
    action: "author_explicitly_accepts_selected_facts",
    book: HOLD_FAST_BOOK_1_TITLE,
    automated_author_acceptance: false,
  },
  {
    id: "D",
    action: "create_accept_hold_fast_series_bible_canon",
    book: HOLD_FAST_BOOK_1_TITLE,
    automated_author_acceptance: false,
  },
  {
    id: "E",
    action: "run_archivist",
    book: HOLD_FAST_BOOK_2_TITLE,
    automated_author_acceptance: false,
  },
  {
    id: "F",
    action: "compare_book_2_against_accepted_book_1_canon",
    book: HOLD_FAST_BOOK_2_TITLE,
    automated_author_acceptance: false,
  },
  {
    id: "G",
    action: "report_within_book_and_cross_book_conflicts",
    book: HOLD_FAST_BOOK_2_TITLE,
    automated_author_acceptance: false,
  },
] as const;

export const RECKONING_STAGING_PILOT = {
  series: HOLD_FAST_SERIES_TITLE,
  book: HOLD_FAST_BOOK_1_TITLE,
  authorized_to_run: false,
  run_now: false,
  purpose: [
    "read a real full manuscript",
    "extract candidate canon",
    "detect within-book continuity conflicts",
    "measure false positives",
    "measure evidence quality",
    "measure full-novel cost/runtime",
    "make zero authoritative canon changes automatically",
  ],
  must_produce: [
    "findings",
    "both_side_evidence",
    "candidate_canon",
    "entity_ambiguities",
    "model_vs_final_classification_diagnostics",
    "full_cost_ledger",
  ],
  automatic_canon_changes: false,
  author_acceptance: "after_review",
} as const;

export const HOLD_FAST_BOOK_2_GATE = {
  book: HOLD_FAST_BOOK_2_TITLE,
  authorized: false,
  requires: [
    "the_reckoning_pilot_complete",
    "kevin_reviews_archivist_findings",
    "kevin_approves_selected_book_1_canon",
    "accepted_hold_fast_series_bible_canon_exists",
  ],
  then: "No Mercy = Book 2 continuity audit against accepted Book 1 canon",
} as const;

export const HOLD_FAST_PILOT_PLAN = {
  series_title: HOLD_FAST_SERIES_TITLE,
  books: HOLD_FAST_PILOT_BOOKS,
  sequence: HOLD_FAST_PILOT_SEQUENCE,
  author_acceptance_automated: false,
  upload_or_link_now: false,
  run_now: false,
  reckoning_pilot: RECKONING_STAGING_PILOT,
  book_2_gate: HOLD_FAST_BOOK_2_GATE,
} as const;
