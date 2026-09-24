/**
 * Actual deterministic REVISED-11-2 segment plan computed from the pinned
 * staging manuscript. Does not contain manuscript text. Does not authorize a run.
 * Historical REVISED-11 plan remains in reckoning-revised-11-segment-plan.ts.
 */

export const RECKONING_REVISED_11_2_STRUCTURAL_UNITS = [
  { unit_id: "prologue", heading: "PROLOGUE", word_count: 3840 },
  { unit_id: "chapter-01", heading: "CHAPTER ONE", word_count: 3660 },
  { unit_id: "chapter-02", heading: "CHAPTER TWO", word_count: 2297 },
  { unit_id: "chapter-03", heading: "CHAPTER THREE", word_count: 6659 },
  { unit_id: "chapter-04", heading: "CHAPTER FOUR", word_count: 2003 },
  { unit_id: "chapter-05", heading: "CHAPTER FIVE", word_count: 2425 },
  { unit_id: "chapter-06", heading: "CHAPTER SIX", word_count: 1220 },
  { unit_id: "chapter-07", heading: "CHAPTER SEVEN", word_count: 1460 },
  { unit_id: "chapter-08", heading: "CHAPTER EIGHT", word_count: 3911 },
  { unit_id: "chapter-09", heading: "CHAPTER NINE", word_count: 5494 },
  { unit_id: "chapter-10", heading: "CHAPTER TEN", word_count: 3693 },
  { unit_id: "chapter-11", heading: "CHAPTER ELEVEN", word_count: 5593 },
  { unit_id: "chapter-12", heading: "CHAPTER TWELVE", word_count: 6167 },
  { unit_id: "chapter-13", heading: "CHAPTER THIRTEEN", word_count: 4237 },
  { unit_id: "chapter-14", heading: "CHAPTER FOURTEEN", word_count: 6342 },
  { unit_id: "chapter-15", heading: "CHAPTER FIFTEEN", word_count: 7367 },
  { unit_id: "chapter-16", heading: "CHAPTER SIXTEEN", word_count: 2400 },
  { unit_id: "chapter-17", heading: "CHAPTER SEVENTEEN", word_count: 2240 },
  { unit_id: "chapter-18", heading: "CHAPTER EIGHTEEN", word_count: 2475 },
  { unit_id: "chapter-19", heading: "CHAPTER NINETEEN", word_count: 2253 },
  { unit_id: "chapter-20", heading: "CHAPTER TWENTY", word_count: 4565 },
  { unit_id: "chapter-21", heading: "CHAPTER TWENTY-ONE", word_count: 3814 },
  { unit_id: "chapter-22", heading: "CHAPTER TWENTY-TWO", word_count: 1994 },
  { unit_id: "chapter-23", heading: "CHAPTER TWENTY-THREE", word_count: 4076 },
  { unit_id: "chapter-24", heading: "CHAPTER TWENTY-FOUR", word_count: 3845 },
  { unit_id: "chapter-25", heading: "CHAPTER TWENTY-FIVE", word_count: 2861 },
  { unit_id: "chapter-26", heading: "CHAPTER TWENTY-SIX", word_count: 3941 },
  { unit_id: "chapter-27", heading: "CHAPTER TWENTY-SEVEN", word_count: 2758 },
  { unit_id: "chapter-28", heading: "CHAPTER TWENTY-EIGHT", word_count: 4487 },
  { unit_id: "chapter-29", heading: "CHAPTER TWENTY-NINE", word_count: 1830 },
] as const;

export const RECKONING_REVISED_11_2_SEGMENT_PLAN = {
  planner_version: "archivist_segment_planner@v1",
  plan_fingerprint: "a7245bb6ae7b9a7e589e5ade1787973047e44d8546f47f1a4de3b57c24106409",
  segment_count: 14,
  unique_manuscript_words: 109907,
  overlap_words: 27625,
  coverage_percentage: 100,
  complete: true,
  segments: [
    { segment_id: "seg-01-prologue-chapter-02", primary: ["prologue", "chapter-01", "chapter-02"], unique_words: 9797, overlap_words: 0 },
    { segment_id: "seg-02-chapter-03-chapter-04", primary: ["chapter-03", "chapter-04"], unique_words: 8662, overlap_words: 2297 },
    { segment_id: "seg-03-chapter-05-chapter-08", primary: ["chapter-05", "chapter-06", "chapter-07", "chapter-08"], unique_words: 9016, overlap_words: 2003 },
    { segment_id: "seg-04-chapter-09-chapter-09", primary: ["chapter-09"], unique_words: 5494, overlap_words: 3911 },
    { segment_id: "seg-05-chapter-10-chapter-11", primary: ["chapter-10", "chapter-11"], unique_words: 9286, overlap_words: 1187 },
    { segment_id: "seg-06-chapter-12-chapter-13", primary: ["chapter-12", "chapter-13"], unique_words: 10404, overlap_words: 1153 },
    { segment_id: "seg-07-chapter-14-chapter-14", primary: ["chapter-14"], unique_words: 6342, overlap_words: 1198 },
    { segment_id: "seg-08-chapter-15-chapter-16", primary: ["chapter-15", "chapter-16"], unique_words: 9767, overlap_words: 1166 },
    { segment_id: "seg-09-chapter-17-chapter-19", primary: ["chapter-17", "chapter-18", "chapter-19"], unique_words: 6968, overlap_words: 2400 },
    { segment_id: "seg-10-chapter-20-chapter-21", primary: ["chapter-20", "chapter-21"], unique_words: 8379, overlap_words: 2253 },
    { segment_id: "seg-11-chapter-22-chapter-23", primary: ["chapter-22", "chapter-23"], unique_words: 6070, overlap_words: 3814 },
    { segment_id: "seg-12-chapter-24-chapter-26", primary: ["chapter-24", "chapter-25", "chapter-26"], unique_words: 10647, overlap_words: 1195 },
    { segment_id: "seg-13-chapter-27-chapter-28", primary: ["chapter-27", "chapter-28"], unique_words: 7245, overlap_words: 3941 },
    { segment_id: "seg-14-chapter-29-chapter-29", primary: ["chapter-29"], unique_words: 1830, overlap_words: 1107 },
  ],
} as const;
