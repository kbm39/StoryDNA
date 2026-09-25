/**
 * Breadth-set selection rationale. Design only. No provider call.
 * Does not embed manuscript windows.
 */

export const V2_REAL_BREADTH_PRIOR_SESSION =
  "archivist-v2-real-reckoning-cal-20260925-v1" as const;

export const V2_REAL_BREADTH_SELECTION_REASON = {
  "R8-001": "only unused CLOCK_TIME_CONTRADICTION case; two dated discovery/log clocks",
  "R8-007": "only unused OBJECT_POSSESSION case; Zodiac versus launch on the same exfil",
  "R8-012": "only unused RELATIONSHIP_CONTINUITY case; born daughter versus unborn-only child",
  "R8-016": "STATEMENT_VS_EVENT without shared container-stack prose; Galit vetting versus Avi never-vetted",
  "R8-023": "only unused IDENTITY_CONTINUITY case; office-passing contractor versus Cyrus/Ibrahim",
  "R8-025": "TRAVEL_TIME_IMPOSSIBILITY with two explicit clocks and a named aircraft; unused versus R8-042",
} as const;

export const V2_REAL_BREADTH_REJECTED = [
  { id: "R8-010", reason: "already sent to Haiku; OPERATIONAL_CAPABILITY" },
  { id: "R8-011", reason: "already sent to Haiku; KNOWLEDGE_BEFORE_ACQUISITION" },
  { id: "R8-029", reason: "already sent to Haiku; INJURY_CONTINUITY" },
  { id: "R8-004", reason: "near-duplicate of R8-027; both Dalia holding / talking clocks" },
  { id: "R8-027", reason: "near-duplicate of R8-004" },
  { id: "R8-014", reason: "near-duplicate prose with R8-018 (container stack)" },
  { id: "R8-018", reason: "near-duplicate prose with R8-014" },
  { id: "R8-013", reason: "repeats KNOWLEDGE_BEFORE_ACQUISITION already measured on R8-011" },
  { id: "R8-015", reason: "repeats KNOWLEDGE_BEFORE_ACQUISITION already measured on R8-011" },
  { id: "R8-020", reason: "repeats INJURY_CONTINUITY already measured on R8-029" },
  { id: "R8-021", reason: "repeats INJURY_CONTINUITY already measured on R8-029" },
  { id: "R8-006", reason: "shares Istanbul / 0447 / Sultanahmet slug with selected R8-025" },
  { id: "R8-026", reason: "TEMPORAL overlaps selected clock/travel coverage; keep unused" },
  { id: "R8-031", reason: "TEMPORAL location-split; keep unused so travel/clock stay distinct" },
  { id: "R8-038", reason: "ATTRIBUTE site-type; OBJECT_POSSESSION already covers naming conflict" },
  { id: "R8-042", reason: "second TRAVEL_TIME case; R8-025 already selected" },
  { id: "R8-005", reason: "STATEMENT_VS_EVENT; R8-016 selected as the cleaner unused pair" },
  { id: "R8-019", reason: "STATEMENT_VS_EVENT; R8-016 selected" },
] as const;

export const V2_REAL_BREADTH_REMAINING_UNSEEN = [
  "R8-004",
  "R8-005",
  "R8-006",
  "R8-013",
  "R8-014",
  "R8-015",
  "R8-018",
  "R8-019",
  "R8-020",
  "R8-021",
  "R8-026",
  "R8-027",
  "R8-031",
  "R8-038",
  "R8-042",
] as const;
