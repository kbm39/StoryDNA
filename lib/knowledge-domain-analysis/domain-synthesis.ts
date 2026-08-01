/**
 * KDA-2 — Deterministic EIC domain synthesis from bounded Independent Read input.
 * No provider calls; evidence-driven domain identification only.
 */

import type { AuthorIntentRecord } from "@/lib/author-intent/types.ts";
import type { EditorialUnderstandingRecord } from "@/lib/editorial-understanding/types.ts";
import type {
  EicIndependentReadV1,
  IndependentReadEvidence,
  IndependentReadTechnicalSignal,
} from "@/lib/eic-independent-read/types.ts";
import type { ManuscriptLocator } from "@/lib/editorial-profile/types.ts";
import type { MaterialityLevel, SpecialistNeedLevel } from "@/lib/editorial-profile/contract.ts";
import {
  defaultCapabilityForDomain,
  defaultSequencingForDomain,
  buildCapabilityMapping,
  buildRegistryGap,
  inferSpecialistAvailability,
  resolveCapabilityRegistryEntry,
} from "./capability-registry.ts";
import type {
  DomainCentrality,
  KdaCapabilityKey,
  KdaConfidence,
  KdaDomainKey,
  KdaMateriality,
} from "./contract.ts";
import { KNOWLEDGE_DOMAIN_ANALYSIS_CONTRACT_VERSION } from "./contract.ts";
import { createAuditEvent } from "./audit.ts";
import { kdaMetadataFlags } from "./versioning.ts";
import type {
  ConflictRecord,
  DomainEntry,
  KdaEvidenceEntry,
  KnowledgeDomainAnalysisV1,
  SpecialistRecommendation,
} from "./types.ts";

export type KdaFramingEvidence = {
  readonly author_intent_id?: string | null;
  readonly author_intent_type?: string | null;
  readonly author_success_definition?: string | null;
  readonly priority_domains: readonly string[];
  readonly editorial_understanding_id?: string | null;
  readonly understanding_market_position?: string | null;
  readonly understanding_primary_vision?: string | null;
  readonly manuscript_brief_id?: string | null;
};

export type BoundedKdaSynthesisInput = {
  readonly independent_read_id: string;
  readonly manuscript_id: string;
  readonly manuscript_version_id: string;
  readonly coverage_percent: number;
  readonly framing: KdaFramingEvidence;
  readonly read: EicIndependentReadV1;
};

type DomainSignalBucket = {
  domainKey: KdaDomainKey;
  evidence: KdaEvidenceEntry[];
  manuscriptEvidence: KdaEvidenceEntry[];
  technicalIds: string[];
  maxMateriality: KdaMateriality;
  maxSpecialistNeed: SpecialistNeedLevel | null;
  observationText: string;
};

const DOMAIN_KEYWORD_RULES: Readonly<
  Record<
    KdaDomainKey,
    { readonly keywords: readonly string[]; readonly technicalAliases: readonly string[] }
  >
> = Object.freeze({
  police_procedure: Object.freeze({
    keywords: Object.freeze([
      "detective",
      "interrogation",
      "interview",
      "warrant",
      "wiretap",
      "affidavit",
      "arrest",
      "surveillance",
      "chain of custody",
      "evidence handling",
      "tactical entry",
      "internal affairs",
      "informant handling",
      "squad briefing",
    ]),
    technicalAliases: Object.freeze(["police", "police_procedure", "law_enforcement", "detective"]),
  }),
  organized_crime: Object.freeze({
    keywords: Object.freeze([
      "crew hierarchy",
      "mob",
      "racket",
      "soldier",
      "earner",
      "skimming",
      "front business",
      "kickback",
      "retaliation",
      "succession",
      "criminal enterprise",
      "loyalty",
      "discipline",
    ]),
    technicalAliases: Object.freeze(["organized_crime", "mob", "racketeering"]),
  }),
  criminal_law_prosecutorial: Object.freeze({
    keywords: Object.freeze([
      "charging",
      "plea",
      "grand jury",
      "admissibility",
      "prosecut",
      "cooperation agreement",
      "prosecutorial",
      "witness preparation",
      "evidentiary",
    ]),
    technicalAliases: Object.freeze([
      "criminal_law",
      "prosecutorial",
      "legal_procedure",
      "prosecution",
    ]),
  }),
  military_operations: Object.freeze({
    keywords: Object.freeze([
      "firefight",
      "convoy",
      "tactical sequence",
      "operational detail",
      "chain of command",
      "room entry",
      "ambush",
    ]),
    technicalAliases: Object.freeze(["military", "military_tactics", "military_operations"]),
  }),
  firearms: Object.freeze({ keywords: Object.freeze(["firearm", "ballistics"]), technicalAliases: [] }),
  forensics: Object.freeze({ keywords: Object.freeze(["forensic", "dna lab"]), technicalAliases: [] }),
  medical_clinical: Object.freeze({ keywords: Object.freeze(["clinical", "surgery"]), technicalAliases: [] }),
  financial_crimes: Object.freeze({ keywords: Object.freeze(["money laundering", "embezzle"]), technicalAliases: [] }),
  legal_procedure: Object.freeze({ keywords: Object.freeze(["courtroom procedure"]), technicalAliases: [] }),
  intelligence_counterterrorism: Object.freeze({
    keywords: Object.freeze(["counterterror", "intel tradecraft"]),
    technicalAliases: [],
  }),
});

const MATERIALITY_ORDER: readonly KdaMateriality[] = [
  "critical",
  "high",
  "moderate",
  "low",
  "negligible",
  "not_material",
];

const SPECIALIST_NEED_ORDER: readonly SpecialistNeedLevel[] = [
  "critical",
  "high",
  "medium",
  "low",
  "none",
];

function toManuscriptLocator(locator: IndependentReadEvidence["locator"]): ManuscriptLocator {
  return Object.freeze({
    chapter_id: locator.chapter_id ?? null,
    chapter_label: locator.chapter_label,
    scene_id: locator.scene_id ?? null,
    paragraph_range: locator.paragraph_range ?? null,
    word_offset_start: locator.word_offset_start ?? null,
    word_offset_end: locator.word_offset_end ?? null,
  });
}

function mapReadEvidenceToKda(
  evidence: IndependentReadEvidence,
  source: KdaEvidenceEntry["source"] = "manuscript",
  sourceArtifactId?: string | null,
): KdaEvidenceEntry {
  return Object.freeze({
    evidence_id: `kda-${evidence.evidence_id}`,
    locator: toManuscriptLocator(evidence.locator),
    excerpt: evidence.excerpt ?? null,
    paraphrased_event: null,
    observation: evidence.observation,
    polarity: evidence.polarity,
    source,
    source_artifact_id: sourceArtifactId ?? null,
    confidence: "high",
    uncertainty_notes: [],
    author_display_safe: true,
    display_safety: "author_safe",
  });
}


function mapMateriality(level: MaterialityLevel | string): KdaMateriality {
  if ((MATERIALITY_ORDER as readonly string[]).includes(level)) return level as KdaMateriality;
  return "moderate";
}

function maxMateriality(a: KdaMateriality, b: KdaMateriality): KdaMateriality {
  return MATERIALITY_ORDER.indexOf(a) <= MATERIALITY_ORDER.indexOf(b) ? a : b;
}

function maxSpecialistNeed(a: SpecialistNeedLevel | null, b: SpecialistNeedLevel | null): SpecialistNeedLevel | null {
  if (!a) return b;
  if (!b) return a;
  return SPECIALIST_NEED_ORDER.indexOf(a) <= SPECIALIST_NEED_ORDER.indexOf(b) ? a : b;
}

function textMatchesDomain(text: string, domainKey: KdaDomainKey): boolean {
  const lower = text.toLowerCase();
  const rules = DOMAIN_KEYWORD_RULES[domainKey];
  return rules.keywords.some((kw) => lower.includes(kw));
}

function technicalMatchesDomain(signal: IndependentReadTechnicalSignal, domainKey: KdaDomainKey): boolean {
  const key = String(signal.domain_key).toLowerCase();
  const rules = DOMAIN_KEYWORD_RULES[domainKey];
  if (rules.technicalAliases.some((alias) => key.includes(alias))) return true;
  return textMatchesDomain(`${signal.label} ${signal.observation} ${signal.specialist_need_rationale}`, domainKey);
}

function collectAllReadEvidence(read: EicIndependentReadV1): readonly IndependentReadEvidence[] {
  const buckets: IndependentReadEvidence[] = [];
  const pushAll = (items: readonly IndependentReadEvidence[]) => {
    for (const item of items) buckets.push(item);
  };
  pushAll(read.story_identity.evidence);
  for (const engine of read.story_engines) pushAll(engine.evidence);
  for (const ec of read.editorial_characteristics) pushAll(ec.evidence);
  for (const tc of read.technical_characteristics) pushAll(tc.evidence);
  for (const em of read.emotional_characteristics) pushAll(em.evidence);
  for (const pa of read.protected_assets) pushAll(pa.evidence);
  for (const risk of read.editorial_risks) pushAll(risk.evidence);
  pushAll(read.commercial_signals.hook_evidence);
  return buckets;
}

function ensureBucket(
  map: Map<KdaDomainKey, DomainSignalBucket>,
  domainKey: KdaDomainKey,
): DomainSignalBucket {
  const existing = map.get(domainKey);
  if (existing) return existing;
  const created: DomainSignalBucket = {
    domainKey,
    evidence: [],
    manuscriptEvidence: [],
    technicalIds: [],
    maxMateriality: "low",
    maxSpecialistNeed: null,
    observationText: "",
  };
  map.set(domainKey, created);
  return created;
}

function addEvidenceToBucket(
  bucket: DomainSignalBucket,
  entry: KdaEvidenceEntry,
  materiality: KdaMateriality,
  specialistNeed: SpecialistNeedLevel | null,
): void {
  bucket.evidence.push(entry);
  if (entry.source === "manuscript" || entry.source === "independent_read_interpretation") {
    bucket.manuscriptEvidence.push(entry);
  }
  bucket.maxMateriality = maxMateriality(bucket.maxMateriality, materiality);
  bucket.maxSpecialistNeed = maxSpecialistNeed(bucket.maxSpecialistNeed, specialistNeed);
  bucket.observationText = `${bucket.observationText} ${entry.observation}`.trim();
}

export function extractDomainSignals(read: EicIndependentReadV1): Map<KdaDomainKey, DomainSignalBucket> {
  const map = new Map<KdaDomainKey, DomainSignalBucket>();

  for (const tc of read.technical_characteristics) {
    for (const domainKey of Object.keys(DOMAIN_KEYWORD_RULES) as KdaDomainKey[]) {
      if (!technicalMatchesDomain(tc, domainKey)) continue;
      const bucket = ensureBucket(map, domainKey);
      bucket.technicalIds.push(tc.technical_id);
      const materiality = mapMateriality(tc.materiality);
      for (const ev of tc.evidence) {
        addEvidenceToBucket(
          bucket,
          mapReadEvidenceToKda(ev, "independent_read_interpretation", read.independent_read_id),
          materiality,
          tc.specialist_need,
        );
      }
      if (tc.evidence.length === 0) {
        bucket.maxMateriality = maxMateriality(bucket.maxMateriality, materiality);
        bucket.maxSpecialistNeed = maxSpecialistNeed(bucket.maxSpecialistNeed, tc.specialist_need);
      }
    }
  }

  for (const ev of collectAllReadEvidence(read)) {
    for (const domainKey of Object.keys(DOMAIN_KEYWORD_RULES) as KdaDomainKey[]) {
      if (!textMatchesDomain(`${ev.observation} ${ev.excerpt ?? ""}`, domainKey)) continue;
      const bucket = ensureBucket(map, domainKey);
      addEvidenceToBucket(
        bucket,
        mapReadEvidenceToKda(ev, "manuscript"),
        "moderate",
        null,
      );
    }
  }

  return map;
}

function inferCentrality(bucket: DomainSignalBucket): DomainCentrality {
  const count = bucket.manuscriptEvidence.length;
  const chapters = new Set(bucket.manuscriptEvidence.map((e) => e.locator.chapter_label)).size;

  if (count === 0) return "insufficient_evidence";
  if (/perhaps|maybe|speculative|unclear if/i.test(bucket.observationText) && count < 2) {
    return "speculative";
  }
  if (
    count >= 5 ||
    (chapters >= 3 && count >= 3 && ["critical", "high"].includes(bucket.maxMateriality))
  ) {
    return "central";
  }
  if (
    count >= 2 &&
    (["critical", "high", "moderate"].includes(bucket.maxMateriality) ||
      bucket.maxSpecialistNeed === "critical" ||
      bucket.maxSpecialistNeed === "high")
  ) {
    return "substantial_supporting";
  }
  if (count === 1 && bucket.maxMateriality === "low") return "incidental";
  if (count <= 2) return "limited_scene_specific";
  if (bucket.maxMateriality === "not_material" || bucket.maxMateriality === "negligible") {
    return "not_material";
  }
  return "limited_scene_specific";
}

function inferDomainMateriality(bucket: DomainSignalBucket, centrality: DomainCentrality): KdaMateriality {
  if (centrality === "not_material") return "not_material";
  if (centrality === "incidental") return "low";
  if (centrality === "insufficient_evidence" || centrality === "speculative") return "low";
  return bucket.maxMateriality;
}

function inferDomainConfidence(bucket: DomainSignalBucket, readCoverage: number): KdaConfidence {
  if (bucket.manuscriptEvidence.length === 0) return "unknown";
  if (readCoverage < 60) return "low";
  if (bucket.manuscriptEvidence.length >= 3) return "high";
  return "medium";
}

function chapterSummary(evidence: readonly KdaEvidenceEntry[]): string {
  const chapters = [...new Set(evidence.map((e) => e.locator.chapter_label))].slice(0, 5);
  return chapters.join(", ");
}

function buildAuthorFacingExplanation(
  domainKey: KdaDomainKey,
  bucket: DomainSignalBucket,
  centrality: DomainCentrality,
): string {
  const chapters = chapterSummary(bucket.manuscriptEvidence);
  const where = chapters ? `In ${chapters}, ` : "On the page, ";

  switch (domainKey) {
    case "police_procedure":
      return `${where}police work is not background — it drives investigations, interviews, warrants, and evidence handling that readers will judge against real procedure. Because inaccurate procedure would undermine reader trust in your turning points, Police Procedures expertise may help if you approve adding that capability later.`;
    case "organized_crime":
      return `${where}organized-crime hierarchy, enterprise logic, and internal discipline materially shape antagonist causality. Crime-fiction readers will judge crew structure, retaliation, and racket patterns against authentic organized-crime behavior.`;
    case "criminal_law_prosecutorial":
      return `${where}charging decisions, cooperation offers, and evidentiary admissibility affect legal payoff distinct from detective work alone. Prosecutorial authenticity may matter before you finalize investigative or courtroom consequences.`;
    case "military_operations":
      if (centrality === "incidental" || centrality === "not_material") {
        return `${where}military texture appears briefly and does not currently drive plot causality enough to recommend specialist review ahead of higher-priority domains.`;
      }
      return `${where}operational and tactical sequences require readers to believe command decisions, movement, and contact under pressure.`;
    default:
      return `${where}this domain appears with enough on-page signal to note for editorial planning. Further evidence may refine this assessment.`;
  }
}

function buildDemonstratedNeed(domainKey: KdaDomainKey, bucket: DomainSignalBucket): string {
  const chapters = chapterSummary(bucket.manuscriptEvidence);
  return `${String(domainKey).replace(/_/g, " ")} material appears across ${chapters || "sampled scenes"} with ${bucket.manuscriptEvidence.length} grounded observation(s).`;
}

function buildDomainEntry(
  domainId: string,
  bucket: DomainSignalBucket,
  readCoverage: number,
  framing: KdaFramingEvidence,
): DomainEntry {
  const centrality = inferCentrality(bucket);
  const materiality = inferDomainMateriality(bucket, centrality);
  const confidence = inferDomainConfidence(bucket, readCoverage);
  const capabilityKey = defaultCapabilityForDomain(bucket.domainKey);
  const sequencing = defaultSequencingForDomain(bucket.domainKey, centrality);
  const registryEntry = capabilityKey ? resolveCapabilityRegistryEntry(capabilityKey) : null;
  const registryGap = registryEntry?.is_available === false;
  const recommendable =
    ["central", "substantial_supporting", "limited_scene_specific"].includes(centrality) &&
    confidence !== "unknown" &&
    confidence !== "low" &&
    bucket.manuscriptEvidence.length > 0;

  const recommendationStatus = recommendable ? ("proposed" as const) : ("not_recommended" as const);
  const recommendationIds = recommendable ? Object.freeze([`rec-${domainId}`]) : Object.freeze([]);

  let authorAuthenticity: DomainEntry["author_authenticity_priority"] = "neutral";
  const priority = framing.priority_domains.map((d) => d.toLowerCase());
  if (
    priority.some((p) => bucket.domainKey.includes(p) || p.includes(bucket.domainKey)) ||
    (framing.author_intent_type?.includes("crime") && bucket.domainKey === "organized_crime")
  ) {
    authorAuthenticity = "elevates";
  }

  return Object.freeze({
    domain_id: domainId,
    domain_key: bucket.domainKey,
    author_facing_name: bucket.domainKey.replace(/_/g, " "),
    description: buildAuthorFacingExplanation(bucket.domainKey, bucket, centrality),
    centrality,
    materiality,
    narrative_role: centrality === "central" ? "Plot-driving domain" : null,
    manuscript_locations: Object.freeze(
      [...new Map(bucket.manuscriptEvidence.map((e) => [e.locator.chapter_label, e.locator])).values()],
    ),
    evidence: Object.freeze([...bucket.evidence]),
    confidence,
    uncertainty_notes: readCoverage < 70 ? Object.freeze(["Independent read coverage below confirmation threshold"]) : [],
    conflicting_evidence: Object.freeze([]),
    consequence_if_inaccurate:
      centrality === "central"
        ? "Reader trust in plot causality would collapse"
        : "Localized credibility loss",
    reader_trust_impact: centrality === "central" ? "severe" : "moderate",
    plot_causality_impact:
      centrality === "central" ? "drives_turning_points" : centrality === "incidental" ? "minimal" : "supports",
    character_credibility_impact: centrality === "central" ? "severe" : "minor",
    commercial_relevance: null,
    sensitivity_relevance: null,
    author_authenticity_priority: authorAuthenticity,
    capability_requirements: capabilityKey ? Object.freeze([capabilityKey]) : Object.freeze([]),
    recommendation_ids: recommendationIds,
    sequencing,
    specialist_availability: capabilityKey
      ? inferSpecialistAvailability(capabilityKey, registryGap ? `gap-${domainId}` : null)
      : "unknown",
    registry_gap_status: registryGap,
    recommendation_status: recommendationStatus,
    author_response_status: "none",
    roadmap_relevance:
      centrality === "central" ? "required_input" : centrality === "substantial_supporting" ? "optional_input" : "not_applicable",
  });
}

function buildRecommendationForDomain(
  domain: DomainEntry,
  bucket: DomainSignalBucket,
  registryGapId: string | null,
): SpecialistRecommendation | null {
  if (domain.recommendation_status !== "proposed") return null;
  const capabilityKey = domain.capability_requirements[0];
  if (!capabilityKey) return null;
  const registry = resolveCapabilityRegistryEntry(String(capabilityKey));
  const availability = inferSpecialistAvailability(capabilityKey as KdaCapabilityKey, registryGapId);

  return Object.freeze({
    recommendation_id: domain.recommendation_ids[0] ?? `rec-${domain.domain_id}`,
    domain_id: domain.domain_id,
    demonstrated_need: buildDemonstratedNeed(domain.domain_key as KdaDomainKey, bucket),
    manuscript_evidence_ids: Object.freeze(bucket.manuscriptEvidence.map((e) => e.evidence_id)),
    centrality: domain.centrality,
    materiality: domain.materiality,
    capability_rationale: domain.description,
    candidate_capability_key: capabilityKey,
    candidate_expert_keys: Object.freeze([...(registry?.candidate_expert_keys ?? [])]),
    candidate_expert_family: registry?.candidate_expert_family ?? null,
    capability_coverage: registry?.is_available
      ? `${domain.author_facing_name} scenes in read coverage`
      : "Required capability not registered",
    certification_status: registry?.is_certified ? "certified" : "unknown",
    availability,
    commercial_enablement_status: "not_commercially_enabled",
    manuscript_access_status: "not_shared",
    confidence: domain.confidence,
    uncertainty_notes: Object.freeze([...domain.uncertainty_notes]),
    related_protected_asset_ids: [],
    related_risk_ids: [],
    related_opportunity_ids: [],
    sequence: domain.sequencing ?? "unresolved",
    sequencing_rationale: `Sequencing reflects ${domain.centrality} centrality and plot dependency — not a full Editorial Roadmap.`,
    author_facing_explanation: domain.description,
    author_response_status: "none",
    consent_status: "not_requested",
    activation_status: "not_activated",
    recommendation_status: "proposed",
    registry_gap_id: registryGapId,
  });
}

function detectAuthorIntentConflict(
  read: EicIndependentReadV1,
  framing: KdaFramingEvidence,
  domain: DomainEntry,
): ConflictRecord | null {
  const authorMarket = framing.understanding_market_position?.trim().toLowerCase() ?? "";
  const authorComp = read.commercial_signals.author_market_framing?.trim().toLowerCase() ?? "";
  if (!authorMarket && !authorComp) return null;

  const authorSaysLiterary = authorMarket.includes("literary") || authorComp.includes("literary");
  const demonstratedCrime =
    domain.domain_key === "organized_crime" || domain.domain_key === "police_procedure";

  if (authorSaysLiterary && demonstratedCrime) {
    return Object.freeze({
      conflict_id: `conflict-${domain.domain_id}-framing`,
      description: "Author framing diverges from demonstrated crime-fiction domain signals",
      signal_a: framing.understanding_market_position ?? read.commercial_signals.author_market_framing ?? "",
      signal_b: read.story_identity.label,
      evidence_ids: Object.freeze(domain.evidence.slice(0, 2).map((e) => e.evidence_id)),
      visible_to_author: true,
    });
  }
  return null;
}

function appendFramingEvidence(
  domains: DomainEntry[],
  framing: KdaFramingEvidence,
): DomainEntry[] {
  if (!framing.author_intent_id) return domains;
  return domains.map((domain) => {
    const aligned = framing.priority_domains.some(
      (p) => domain.domain_key.toString().includes(p) || p.includes(domain.domain_key.toString()),
    );
    if (!aligned) return domain;
    const intentEvidence: KdaEvidenceEntry = Object.freeze({
      evidence_id: `kda-intent-${domain.domain_id}`,
      locator: Object.freeze({
        chapter_label: "Author Intent",
        chapter_id: null,
        scene_id: null,
      }),
      excerpt: null,
      paraphrased_event: framing.author_success_definition ?? null,
      observation: `Author prioritizes ${framing.priority_domains.join(", ")} — intent aligns with ${domain.author_facing_name}`,
      polarity: "supporting",
      source: "author_intent",
      source_artifact_id: framing.author_intent_id,
      confidence: "medium",
      uncertainty_notes: [],
      author_display_safe: true,
      display_safety: "author_safe",
    });
    return Object.freeze({
      ...domain,
      evidence: Object.freeze([...domain.evidence, intentEvidence]),
    });
  });
}

export function buildFramingEvidence(input: {
  authorIntent?: AuthorIntentRecord | null;
  editorialUnderstanding?: EditorialUnderstandingRecord | null;
  manuscriptBriefId?: string | null;
}): KdaFramingEvidence {
  return Object.freeze({
    author_intent_id: input.authorIntent?.id ?? null,
    author_intent_type: input.authorIntent?.intent_type ?? null,
    author_success_definition: input.authorIntent?.author_success_definition ?? null,
    priority_domains: Object.freeze([...(input.authorIntent?.priority_domains ?? [])]),
    editorial_understanding_id: input.editorialUnderstanding?.understanding_id ?? null,
    understanding_market_position: input.editorialUnderstanding?.market_position ?? null,
    understanding_primary_vision: input.editorialUnderstanding?.primary_vision ?? null,
    manuscript_brief_id: input.manuscriptBriefId ?? null,
  });
}

export function buildBoundedKdaSynthesisInput(input: {
  independentRead: EicIndependentReadV1;
  authorIntent?: AuthorIntentRecord | null;
  editorialUnderstanding?: EditorialUnderstandingRecord | null;
  manuscriptBriefId?: string | null;
}): BoundedKdaSynthesisInput {
  return Object.freeze({
    independent_read_id: input.independentRead.independent_read_id,
    manuscript_id: input.independentRead.manuscript_id,
    manuscript_version_id: input.independentRead.manuscript_version_id,
    coverage_percent: input.independentRead.coverage_percent,
    framing: buildFramingEvidence(input),
    read: input.independentRead,
  });
}

export function synthesizeKdaFromBoundedInput(input: {
  analysisId: string;
  eicExecutionId: string;
  synthesisInput: BoundedKdaSynthesisInput;
  generatedAt: string;
}): KnowledgeDomainAnalysisV1 {
  const { read, framing, coverage_percent: coveragePercent } = input.synthesisInput;
  const signalMap = extractDomainSignals(read);

  let domainIndex = 0;
  const domains: DomainEntry[] = [];
  const bucketsByDomainId = new Map<string, DomainSignalBucket>();

  for (const bucket of signalMap.values()) {
    domainIndex += 1;
    const domainId = `domain-${bucket.domainKey}-${domainIndex}`;
    const domain = buildDomainEntry(domainId, bucket, coveragePercent, framing);
    domains.push(domain);
    bucketsByDomainId.set(domainId, bucket);
  }

  const domainsWithFraming = appendFramingEvidence(domains, framing);

  const domainsWithConflicts = domainsWithFraming.map((domain) => {
    const conflict = detectAuthorIntentConflict(read, framing, domain);
    if (!conflict) return domain;
    return Object.freeze({
      ...domain,
      conflicting_evidence: Object.freeze([...domain.conflicting_evidence, conflict]),
    });
  });

  const capabilityMappings = domainsWithConflicts.flatMap((domain) => {
    const capabilityKey = domain.capability_requirements[0];
    if (!capabilityKey) return [];
    const bucket = bucketsByDomainId.get(domain.domain_id);
    if (!bucket) return [];
    const gapId = domain.registry_gap_status ? `gap-${domain.domain_id}` : null;
    return [
      buildCapabilityMapping({
        mappingId: `map-${domain.domain_id}`,
        domainId: domain.domain_id,
        capabilityKey: capabilityKey as KdaCapabilityKey,
        capabilityScope: `${domain.author_facing_name} authenticity`,
        relevanceReason: domain.description.slice(0, 120),
        evidenceIds: bucket.manuscriptEvidence.map((e) => e.evidence_id),
        confidence: domain.confidence,
        registryGapId: gapId,
      }),
    ];
  });

  const registryGaps = domainsWithConflicts.flatMap((domain) => {
    if (!domain.registry_gap_status) return [];
    const capabilityKey = domain.capability_requirements[0];
    if (!capabilityKey) return [];
    const bucket = bucketsByDomainId.get(domain.domain_id);
    if (!bucket) return [];
    return [
      buildRegistryGap({
        gapId: `gap-${domain.domain_id}`,
        domainId: domain.domain_id,
        capabilityKey: capabilityKey as KdaCapabilityKey,
        reason: `Central ${domain.author_facing_name} authenticity with no certified capability in registry`,
        evidenceIds: bucket.manuscriptEvidence.map((e) => e.evidence_id),
        centrality: domain.centrality,
        materiality: domain.materiality,
        confidence: domain.confidence,
        authorFacingExplanation:
          domain.domain_key === "organized_crime"
            ? "This manuscript materially depends on organized-crime authenticity. StoryDNA has identified that need, but an appropriate specialist is not yet available in the current editorial team."
            : `StoryDNA identified a material need for ${domain.author_facing_name}, but no appropriate registered capability is currently available.`,
        createdAt: input.generatedAt,
      }),
    ];
  });

  const recommendations = domainsWithConflicts.flatMap((domain) => {
    const bucket = bucketsByDomainId.get(domain.domain_id);
    if (!bucket) return [];
    const gapId = domain.registry_gap_status ? `gap-${domain.domain_id}` : null;
    const rec = buildRecommendationForDomain(domain, bucket, gapId);
    return rec ? [rec] : [];
  });

  const synthesisConfidence = Object.freeze({
    overall_confidence:
      domainsWithConflicts.length === 0
        ? ("low" as const)
        : domainsWithConflicts.some((d) => d.confidence === "high")
          ? ("high" as const)
          : ("medium" as const),
    independent_read_coverage: coveragePercent,
    domains_at_low_confidence: Object.freeze(
      domainsWithConflicts.filter((d) => d.confidence === "low").map((d) => d.domain_id),
    ),
    uncovered_regions: Object.freeze(
      coveragePercent < 70 ? ["Coverage below EIC confirmation threshold"] : [],
    ),
  });

  const auditEvent = createAuditEvent({
    event_id: `audit-${input.analysisId}-created`,
    event_type: "analysis_created",
    timestamp: input.generatedAt,
    actor: "eic",
    summary: "KDA candidate synthesized from independent read",
    related_ids: Object.freeze([input.analysisId, read.independent_read_id]),
    prior_state: "generating",
    new_state: "draft",
  });

  return Object.freeze({
    contract_version: KNOWLEDGE_DOMAIN_ANALYSIS_CONTRACT_VERSION,
    analysis_id: input.analysisId,
    manuscript_id: read.manuscript_id,
    manuscript_version_id: read.manuscript_version_id,
    independent_read_id: read.independent_read_id,
    editorial_profile_id: null,
    author_intent_id: framing.author_intent_id ?? null,
    editorial_understanding_id: framing.editorial_understanding_id ?? null,
    eic_execution_id: input.eicExecutionId,
    status: "generating",
    created_at: input.generatedAt,
    updated_at: input.generatedAt,
    activated_at: null,
    supersedes_analysis_id: null,
    superseded_by_analysis_id: null,
    trigger_event: "independent_read_complete",
    domains: Object.freeze(domainsWithConflicts),
    capability_mappings: Object.freeze(capabilityMappings),
    recommendations: Object.freeze(recommendations),
    registry_gaps: Object.freeze(registryGaps),
    author_responses: Object.freeze([]),
    eic_confirmation: null,
    provenance: Object.freeze({
      independent_read_id: read.independent_read_id,
      author_intent_id: framing.author_intent_id ?? null,
      editorial_understanding_id: framing.editorial_understanding_id ?? null,
      manuscript_brief_id: framing.manuscript_brief_id ?? null,
      editorial_profile_id: null,
      synthesis_timestamp: input.generatedAt,
      read_coverage_percent: coveragePercent,
      uncovered_regions: synthesisConfidence.uncovered_regions,
      specialist_manuscript_access_count: 0,
    }),
    audit_history: Object.freeze([auditEvent]),
    synthesis_confidence: synthesisConfidence,
    ...kdaMetadataFlags(),
  });
}

export { DOMAIN_KEYWORD_RULES, inferCentrality };
