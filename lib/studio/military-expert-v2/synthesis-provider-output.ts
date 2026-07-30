/**
 * Normalize provider synthesis JSON before contract merge.
 */

import type { MilitaryExpertSceneCategoryTag } from "./scene-review-contract.ts";

const DOMAIN_ALIASES: Record<string, MilitaryExpertSceneCategoryTag> = {
  firefight: "firefight_or_battle",
  battle: "firefight_or_battle",
  firefight_or_battle: "firefight_or_battle",
  movement: "movement_and_cover",
  movement_and_cover: "movement_and_cover",
  cover: "movement_and_cover",
  breach: "room_entry_or_breach",
  room_entry: "room_entry_or_breach",
  room_entry_or_breach: "room_entry_or_breach",
  team_coordination: "team_coordination",
  coordination: "team_coordination",
  command: "command_and_control",
  command_and_control: "command_and_control",
  communications: "radio_and_communications",
  radio: "radio_and_communications",
  radio_and_communications: "radio_and_communications",
  weapons: "weapons_handling",
  weapons_handling: "weapons_handling",
  timing: "timing_and_physical_realism",
  timing_and_physical_realism: "timing_and_physical_realism",
  convoy: "convoy_and_vehicle_contact",
  convoy_and_vehicle_contact: "convoy_and_vehicle_contact",
  aviation: "aviation",
  casualty: "casualty_response",
  casualty_response: "casualty_response",
  intelligence: "intelligence_and_planning",
  intelligence_and_planning: "intelligence_and_planning",
  military_culture: "military_culture",
  other: "other",
};

function normalizeDomains(raw: unknown): string[] {
  if (!Array.isArray(raw)) return ["other"];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const key = item.trim().toLowerCase().replace(/\s+/g, "_");
    const mapped = DOMAIN_ALIASES[key] ?? DOMAIN_ALIASES[item] ?? "other";
    if (!out.includes(mapped)) out.push(mapped);
  }
  return out.length > 0 ? out : ["other"];
}

function snakeCaseKey(key: string): string {
  return key.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
}

function deepSnakeCase(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deepSnakeCase);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[snakeCaseKey(key)] = deepSnakeCase(val);
  }
  return out;
}

function normalizeFinding(raw: unknown, index: number): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = { ...(raw as Record<string, unknown>) };

  if (!obj.plain_english_explanation && typeof obj.plainEnglishExplanation === "string") {
    obj.plain_english_explanation = obj.plainEnglishExplanation;
  }
  if (!obj.source_scene_ids && Array.isArray(obj.sourceSceneIds)) {
    obj.source_scene_ids = obj.sourceSceneIds;
  }
  if (!obj.source_scene_review_ids && Array.isArray(obj.sourceSceneReviewIds)) {
    obj.source_scene_review_ids = obj.sourceSceneReviewIds;
  }
  if (!obj.best_locators && Array.isArray(obj.bestLocators)) {
    obj.best_locators = obj.bestLocators;
  }
  if (!obj.evidence_summary && typeof obj.evidenceSummary === "string") {
    obj.evidence_summary = obj.evidenceSummary;
  }
  if (!obj.why_it_matters && typeof obj.whyItMatters === "string") {
    obj.why_it_matters = obj.whyItMatters;
  }
  if (!obj.contrary_evidence_summary && typeof obj.contraryEvidenceSummary === "string") {
    obj.contrary_evidence_summary = obj.contraryEvidenceSummary;
  }
  if (!obj.safe_editorial_guidance && typeof obj.safeEditorialGuidance === "string") {
    obj.safe_editorial_guidance = obj.safeEditorialGuidance;
  }
  if (!obj.revision_significance && typeof obj.revisionSignificance === "string") {
    obj.revision_significance = obj.revisionSignificance;
  }
  if (!obj.synthesis_kind && typeof obj.synthesisKind === "string") {
    obj.synthesis_kind = obj.synthesisKind;
  }
  if (!obj.finding_id && typeof obj.findingId === "string") {
    obj.finding_id = obj.findingId;
  }

  if (!obj.finding_id) obj.finding_id = `sf_${String(index + 1).padStart(3, "0")}`;
  if (typeof obj.contrary_evidence_summary !== "string") obj.contrary_evidence_summary = "";
  if (!obj.best_locators) obj.best_locators = [];
  if (!Array.isArray(obj.best_locators)) obj.best_locators = [String(obj.best_locators)];
  obj.military_domains = normalizeDomains(obj.military_domains);
  if (!obj.synthesis_kind) obj.synthesis_kind = "single_scene";
  const kindKey = String(obj.synthesis_kind).trim().toLowerCase();
  const kindAliases: Record<string, string> = {
    cross_scene: "cross_scene_pattern",
    pattern: "cross_scene_pattern",
    single: "single_scene",
    book: "book_level",
  };
  obj.synthesis_kind = kindAliases[kindKey] ?? kindKey;
  if (obj.synthesis_kind === "book_level" && Array.isArray(obj.source_scene_ids) && obj.source_scene_ids.length < 3) {
    obj.synthesis_kind = "cross_scene_pattern";
  }
  if (!obj.determination) obj.determination = "confirmed";
  if (!obj.confidence) obj.confidence = "medium";
  if (obj.confidence === "moderate") obj.confidence = "medium";
  if (!obj.revision_significance) obj.revision_significance = "important";
  if (obj.revision_significance === "high") obj.revision_significance = "critical";
  if (obj.revision_significance === "low") obj.revision_significance = "minor";
  const explanation =
    typeof obj.plain_english_explanation === "string" ? obj.plain_english_explanation.trim() : "";
  if (!obj.evidence_summary && explanation) obj.evidence_summary = explanation.slice(0, 280);
  if (!obj.why_it_matters && explanation) obj.why_it_matters = explanation.slice(0, 220);
  if (!obj.safe_editorial_guidance) {
    obj.safe_editorial_guidance =
      "Revise this scene with a military consultant to preserve authenticity without adding procedural instruction.";
  }
  if (!Array.isArray(obj.best_locators) || obj.best_locators.length === 0) {
    const sceneIds = Array.isArray(obj.source_scene_ids) ? obj.source_scene_ids : [];
    obj.best_locators = sceneIds.length > 0 ? [`Scene ${sceneIds[0]}`] : ["Selected scene review"];
  }
  return obj;
}

function normalizeRecurring(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = { ...(raw as Record<string, unknown>) };
  if (!obj.explanation && typeof obj.summary === "string") obj.explanation = obj.summary;
  if (!obj.source_scene_ids && Array.isArray(obj.sourceSceneIds)) obj.source_scene_ids = obj.sourceSceneIds;
  if (!isNonEmptyString(obj.title) || !isNonEmptyString(obj.explanation)) return null;
  if (!Array.isArray(obj.source_scene_ids) || obj.source_scene_ids.length === 0) return null;
  return obj;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizeSynthesisProviderOutput(
  raw: unknown,
  sceneReviewIdBySceneId: ReadonlyMap<string, string>,
): unknown {
  const snake = deepSnakeCase(raw);
  if (!snake || typeof snake !== "object") return snake;
  const obj = { ...(snake as Record<string, unknown>) };

  const normalizeFindingList = (list: unknown, offset: number) => {
    if (!Array.isArray(list)) return [];
    return list
      .map((item, i) => normalizeFinding(item, offset + i))
      .filter((item): item is Record<string, unknown> => item !== null)
      .map((finding) => {
        const sceneIds = Array.isArray(finding.source_scene_ids)
          ? finding.source_scene_ids.filter((id): id is string => typeof id === "string")
          : [];
        const reviewIds = Array.isArray(finding.source_scene_review_ids)
          ? finding.source_scene_review_ids.filter((id): id is string => typeof id === "string")
          : sceneIds
              .map((sceneId) => sceneReviewIdBySceneId.get(sceneId))
              .filter((id): id is string => typeof id === "string");
        return { ...finding, source_scene_ids: sceneIds, source_scene_review_ids: reviewIds };
      });
  };

  obj.single_scene_findings = normalizeFindingList(obj.single_scene_findings, 0);
  obj.cross_scene_findings = normalizeFindingList(
    obj.cross_scene_findings,
    (obj.single_scene_findings as unknown[]).length,
  );

  const allFindings = [
    ...(obj.single_scene_findings as Record<string, unknown>[]),
    ...(obj.cross_scene_findings as Record<string, unknown>[]),
  ];
  const findingIds = allFindings.map((f) => String(f.finding_id));

  if (!Array.isArray(obj.top_priority_findings) || obj.top_priority_findings.length === 0) {
    obj.top_priority_findings = findingIds.slice(0, 12);
  }
  if (!Array.isArray(obj.author_review_required_items)) {
    obj.author_review_required_items = allFindings
      .filter((f) => f.determination === "author_review_required")
      .map((f) => String(f.finding_id));
  }
  if (!Array.isArray(obj.recurring_strengths)) obj.recurring_strengths = [];
  else {
    obj.recurring_strengths = obj.recurring_strengths
      .map(normalizeRecurring)
      .filter((item): item is Record<string, unknown> => item !== null);
  }
  if (!Array.isArray(obj.recurring_concerns)) obj.recurring_concerns = [];
  else {
    obj.recurring_concerns = obj.recurring_concerns
      .map(normalizeRecurring)
      .filter((item): item is Record<string, unknown> => item !== null);
  }
  if (!Array.isArray(obj.top_revision_priorities)) {
    obj.top_revision_priorities = (obj.top_priority_findings as string[]).slice(0, 5);
  }
  if (!obj.methodology_scope_statement) {
    obj.methodology_scope_statement =
      "This report synthesizes completed scene-level Military Expert reviews only.";
  }
  if (!obj.overall_authenticity_assessment && typeof obj.overall_assessment === "string") {
    obj.overall_authenticity_assessment = obj.overall_assessment;
  }
  if (obj.coverage_summary && typeof obj.coverage_summary === "object") {
    const cov = { ...(obj.coverage_summary as Record<string, unknown>) };
    if (!cov.scope_statement && typeof cov.scope === "string") cov.scope_statement = cov.scope;
    obj.coverage_summary = cov;
  }

  return obj;
}
