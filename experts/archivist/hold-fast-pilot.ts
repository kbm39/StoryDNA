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

export const HOLD_FAST_PILOT_PLAN = {
  series_title: HOLD_FAST_SERIES_TITLE,
  books: HOLD_FAST_PILOT_BOOKS,
  sequence: HOLD_FAST_PILOT_SEQUENCE,
  author_acceptance_automated: false,
  upload_or_link_now: false,
  run_now: false,
} as const;
