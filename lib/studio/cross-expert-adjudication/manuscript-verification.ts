import {
  excerptInManuscript,
  recommendationOverlapRatio,
  searchManuscriptMarker,
  tokenizeAuditText,
} from "./text-normalize.ts";
import type {
  CrossExpertNormalizedFinding,
  ManuscriptMarkerResult,
  ManuscriptVerificationResult,
} from "./types.ts";

const PAMELA_FORESHADOWING_MARKERS: readonly {
  readonly id: string;
  readonly label: string;
  readonly pattern: string | RegExp;
}[] = [
  { id: "sniper_response", label: "Pamela response under sniper fire", pattern: "sniper" },
  {
    id: "quarter_second",
    label: "Bruce quarter-second observation",
    pattern: /quarter.?second|quarter second/i,
  },
  { id: "go_bag", label: "Prepared go-bag", pattern: /go.?bag|go bag/i },
  {
    id: "avoid_mira",
    label: "Pamela and Mira avoiding each other",
    pattern: /avoid.*Mira|Mira.*avoid/i,
  },
  {
    id: "concealed_weapon",
    label: "Concealed loaded weapons",
    pattern: /concealed.*(weapon|gun|pistol)|loaded.*(weapon|gun|pistol)/i,
  },
  {
    id: "take_money_hurt",
    label: "Plan to take money and hurt James's family",
    pattern: /take the money|hurt.*family|James.*family/i,
  },
  {
    id: "internal_plan",
    label: "Pamela internal betrayal plan",
    pattern: /Pamela.*(plan|money|betray|double)/i,
  },
];

const FIELD_TRANSFUSION_MARKERS: readonly {
  readonly id: string;
  readonly label: string;
  readonly pattern: string | RegExp;
}[] = [
  {
    id: "o_negative",
    label: "James is O-negative / universal donor",
    pattern: /O.?negative|O negative|universal donor/i,
  },
  { id: "dog_tags", label: "Dog-tag knowledge", pattern: /dog tag/i },
  { id: "basic_training", label: "Basic-training blood-type awareness", pattern: /basic training/i },
  {
    id: "donor_risk",
    label: "Donor-risk awareness",
    pattern: /donor.*risk|risk.*donor|volume.*donor/i,
  },
  { id: "citrate", label: "Citrate anticoagulant", pattern: /citrate/i },
  {
    id: "collection_bag",
    label: "Collection bag present",
    pattern: /collection bag|blood bag|IV bag/i,
  },
  { id: "bag_mixing", label: "Bag mixing", pattern: /mix.*bag|bag.*mix/i },
  {
    id: "physiological",
    label: "Donor physiological consequences",
    pattern: /lightheaded|dizzy|weak|pale|hypotension|blood pressure/i,
  },
];

function markerResults(
  manuscriptText: string,
  markers: readonly { readonly id: string; readonly label: string; readonly pattern: string | RegExp }[],
): ManuscriptMarkerResult[] {
  return markers.map((marker) => {
    const result = searchManuscriptMarker(manuscriptText, marker.pattern);
    return Object.freeze({
      markerId: marker.id,
      label: marker.label,
      found: result.found,
      matchCount: result.matchCount,
    });
  });
}

function computeEvidenceSupportRatio(
  manuscriptText: string,
  finding: CrossExpertNormalizedFinding,
): number {
  const evidence = finding.manuscriptEvidence;
  if (evidence.length === 0) return 0;
  const supported = evidence.filter((item) => excerptInManuscript(manuscriptText, item.excerpt)).length;
  return supported / evidence.length;
}

export function verifyFindingAgainstManuscript(args: {
  readonly finding: CrossExpertNormalizedFinding;
  readonly manuscriptText: string;
}): ManuscriptVerificationResult {
  const { finding, manuscriptText } = args;
  const evidenceSupportRatio = computeEvidenceSupportRatio(manuscriptText, finding);
  const recommendationOverlap = recommendationOverlapRatio(manuscriptText, finding.recommendation);

  let markers: readonly ManuscriptMarkerResult[] = [];
  if (/pamela|dual.?agent|foreshadow/i.test(finding.title + finding.summary)) {
    markers = markerResults(manuscriptText, PAMELA_FORESHADOWING_MARKERS);
  } else if (/blood|transfusion|donation|citrate|o.?negative/i.test(finding.title + finding.summary)) {
    markers = markerResults(manuscriptText, FIELD_TRANSFUSION_MARKERS);
  }

  const markerCoverage =
    markers.length === 0
      ? null
      : markers.filter((marker) => marker.found).length / markers.length;

  const recommendationAlreadyPresent =
    finding.source === "military_expert" &&
    markers.length > 0 &&
    (markerCoverage ?? 0) >= 0.6 &&
    recommendationOverlap >= 0.2;

  const evidenceSupported = evidenceSupportRatio >= 0.5;

  let rationale = evidenceSupported
    ? "Manuscript evidence citations are present in the authoritative text."
    : "Manuscript evidence could not be fully verified against the authoritative text.";

  if (recommendationAlreadyPresent) {
    rationale += " Recommended fix largely duplicates content already present in the manuscript.";
  }
  if (markers.length > 0) {
    const foundCount = markers.filter((m) => m.found).length;
    rationale += ` Marker scan: ${foundCount}/${markers.length} expected signals found.`;
  }

  return Object.freeze({
    findingKey: finding.findingKey,
    evidenceSupported,
    evidenceSupportRatio,
    recommendationAlreadyPresent,
    recommendationOverlapRatio: recommendationOverlap,
    markers,
    rationale,
  });
}

export function evaluatePamelaForeshadowing(manuscriptText: string): {
  readonly markers: readonly ManuscriptMarkerResult[];
  readonly foundCount: number;
  readonly totalCount: number;
  readonly coverageRatio: number;
} {
  const markers = markerResults(manuscriptText, PAMELA_FORESHADOWING_MARKERS);
  const foundCount = markers.filter((m) => m.found).length;
  return Object.freeze({
    markers,
    foundCount,
    totalCount: markers.length,
    coverageRatio: markers.length === 0 ? 0 : foundCount / markers.length,
  });
}

export function evaluateFieldTransfusion(manuscriptText: string): {
  readonly markers: readonly ManuscriptMarkerResult[];
  readonly foundCount: number;
  readonly totalCount: number;
  readonly coverageRatio: number;
} {
  const markers = markerResults(manuscriptText, FIELD_TRANSFUSION_MARKERS);
  const foundCount = markers.filter((m) => m.found).length;
  return Object.freeze({
    markers,
    foundCount,
    totalCount: markers.length,
    coverageRatio: markers.length === 0 ? 0 : foundCount / markers.length,
  });
}

export function extractTopicTokens(text: string): string[] {
  const stop = new Set([
    "the",
    "and",
    "for",
    "that",
    "with",
    "this",
    "from",
    "have",
    "chapter",
    "manuscript",
    "sequence",
    "lacks",
    "insufficient",
  ]);
  return tokenizeAuditText(text).filter((token) => !stop.has(token));
}
