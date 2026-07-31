/**
 * Deterministic EIC editorial plan recommendations.
 * Pure logic — no provider calls, no workflow launches.
 */

import type { AuthorIntentType } from "@/lib/author-intent/contract.ts";
import type { AuthorIntentRecord } from "@/lib/author-intent/types.ts";
import { getExpertCatalogEntry } from "@/lib/expert-catalog.ts";
import { classifyExpertExecution } from "@/lib/studio/expert-classification.ts";
import { isStudioMilitaryExpertLocalOverrideEnabled } from "@/lib/studio/military-expert-local-policy.ts";
import {
  EIC_PLAN_CONTRACT_VERSION,
  type EicEditorialPlanV1,
  type ExpertPlanEntry,
  type ExpertPlanTier,
} from "./contract.ts";

type ExpertSpec = {
  key: string;
  displayName: string;
  defaultReason: string;
};

const EXPERT_DISPLAY: Record<string, ExpertSpec> = {
  literary_agent: {
    key: "literary_agent",
    displayName: "Literary Agent",
    defaultReason: "Commercial positioning and submission readiness.",
  },
  developmental_editor: {
    key: "developmental_editor",
    displayName: "Developmental Editor",
    defaultReason: "Structure, pacing, stakes, and narrative architecture.",
  },
  line_editor: {
    key: "line_editor",
    displayName: "Line Editor",
    defaultReason: "Prose clarity, rhythm, and voice consistency.",
  },
  military_expert: {
    key: "military_expert",
    displayName: "Military Expert",
    defaultReason: "Command, rank, tactics, logistics, and operational realism.",
  },
  continuity_expert: {
    key: "continuity_expert",
    displayName: "Continuity / Canon Expert",
    defaultReason: "Series canon, timeline continuity, and internal consistency.",
  },
  timeline_expert: {
    key: "timeline_expert",
    displayName: "Timeline Expert",
    defaultReason: "Cross-book timeline alignment and chronology.",
  },
  archivist: {
    key: "archivist",
    displayName: "Archivist",
    defaultReason: "Series canon records and edition lineage.",
  },
  combat_medicine_expert: {
    key: "combat_medicine_expert",
    displayName: "Combat Medicine Expert",
    defaultReason: "Clinical and field medical accuracy in combat contexts.",
  },
  medical_expert: {
    key: "medical_expert",
    displayName: "Medical Expert",
    defaultReason: "Clinical accuracy and medical realism.",
  },
  financial_crimes_expert: {
    key: "financial_crimes_expert",
    displayName: "Financial Crimes Expert",
    defaultReason: "Fraud, banking, and asset tracing realism.",
  },
};

function resolveExpertTier(key: string): {
  tier: ExpertPlanTier;
  launchable: boolean;
  runtime: string | null;
  cost: string | null;
} {
  const executionClass = classifyExpertExecution(key);

  if (key === "military_expert") {
    if (isStudioMilitaryExpertLocalOverrideEnabled()) {
      return {
        tier: "experimental",
        launchable: false,
        runtime: "10–20 minutes",
        cost: "Varies by manuscript length (local test)",
      };
    }
    return { tier: "unavailable", launchable: false, runtime: null, cost: null };
  }

  const catalog = getExpertCatalogEntry(key as "literary_agent");
  if (executionClass === "READY" && catalog?.selectionEnabled) {
    return {
      tier: "recommended",
      launchable: false,
      runtime: "5–15 minutes",
      cost: "Varies by manuscript length",
    };
  }

  if (executionClass === "EXPERIMENTAL") {
    return { tier: "experimental", launchable: false, runtime: null, cost: null };
  }

  if (executionClass === "PLACEHOLDER") {
    return { tier: "unavailable", launchable: false, runtime: null, cost: null };
  }

  return { tier: "blocked", launchable: false, runtime: null, cost: null };
}

function buildEntry(
  key: string,
  planTier: ExpertPlanTier,
  reason: string,
): ExpertPlanEntry {
  const spec = EXPERT_DISPLAY[key] ?? { key, displayName: key, defaultReason: reason };
  const resolved = resolveExpertTier(key);
  const tier: ExpertPlanTier =
    resolved.tier === "unavailable" ||
    resolved.tier === "experimental" ||
    resolved.tier === "blocked"
      ? resolved.tier
      : planTier;

  return Object.freeze({
    expert_key: key,
    display_name: spec.displayName,
    tier,
    reason: reason || spec.defaultReason,
    launchable: false,
    estimated_runtime: resolved.runtime,
    estimated_cost: resolved.cost,
  });
}

type IntentRecommendation = {
  required: string[];
  recommended: string[];
  optional: string[];
  domains: string[];
  reasons: Record<string, string>;
};

const INTENT_MAP: Record<AuthorIntentType, IntentRecommendation> = {
  general_manuscript_review: {
    required: [],
    recommended: ["literary_agent"],
    optional: ["developmental_editor"],
    domains: ["commercial", "structure"],
    reasons: {
      literary_agent: "Balanced commercial and submission readiness for general review.",
      developmental_editor: "Optional structural depth when author wants architecture feedback.",
    },
  },
  query_preparation: {
    required: [],
    recommended: ["literary_agent"],
    optional: [],
    domains: ["commercial", "market"],
    reasons: {
      literary_agent: "Query preparation prioritizes commercial positioning and hook strength.",
    },
  },
  traditional_publishing: {
    required: [],
    recommended: ["literary_agent"],
    optional: ["developmental_editor"],
    domains: ["commercial", "market"],
    reasons: {
      literary_agent: "Traditional publishing path requires agent-facing submission readiness.",
    },
  },
  self_publishing: {
    required: [],
    recommended: ["literary_agent"],
    optional: ["line_editor"],
    domains: ["commercial", "market"],
    reasons: {
      literary_agent: "Self-publishing requires market positioning and production readiness.",
    },
  },
  kindle_unlimited: {
    required: [],
    recommended: ["literary_agent"],
    optional: [],
    domains: ["commercial", "pacing", "market"],
    reasons: {
      literary_agent: "Kindle Unlimited fit emphasizes pacing, series hooks, and KU market positioning.",
    },
  },
  screenplay_adaptation: {
    required: [],
    recommended: ["literary_agent"],
    optional: [],
    domains: ["structure", "dialogue"],
    reasons: {
      literary_agent: "Adaptation readiness starts with visual set-pieces and act structure (future specialists planned).",
    },
  },
  television_adaptation: {
    required: [],
    recommended: ["literary_agent"],
    optional: ["developmental_editor"],
    domains: ["structure", "character"],
    reasons: {
      literary_agent: "Television adaptation emphasizes ensemble and serial hooks (DE planned).",
    },
  },
  comic_adaptation: {
    required: [],
    recommended: ["literary_agent"],
    optional: [],
    domains: ["structure", "character"],
    reasons: {
      literary_agent: "Comic adaptation emphasizes visual beats and panel density (Character Expert planned).",
    },
  },
  developmental_editing: {
    required: [],
    recommended: ["developmental_editor"],
    optional: ["literary_agent"],
    domains: ["structure", "pacing"],
    reasons: {
      developmental_editor: "Developmental editing focuses on structure, arc, and stakes.",
    },
  },
  copy_editing: {
    required: [],
    recommended: ["line_editor"],
    optional: [],
    domains: ["prose"],
    reasons: {
      line_editor: "Copy editing focuses on prose clarity and consistency (Line Editor planned).",
    },
  },
  military_realism: {
    required: [],
    recommended: ["military_expert"],
    optional: ["literary_agent"],
    domains: ["military"],
    reasons: {
      military_expert: "Military realism intent routes to Military Expert for tactical and operational coverage.",
      literary_agent: "Optional commercial context when author also wants positioning feedback.",
    },
  },
  medical_realism: {
    required: [],
    recommended: ["combat_medicine_expert", "medical_expert"],
    optional: [],
    domains: ["medical"],
    reasons: {
      combat_medicine_expert: "Combat medical scenarios route to Combat Medicine Expert (planned).",
      medical_expert: "General medical realism routes to Medical Expert (planned).",
    },
  },
  financial_realism: {
    required: [],
    recommended: ["financial_crimes_expert"],
    optional: [],
    domains: ["financial"],
    reasons: {
      financial_crimes_expert: "Financial realism routes to Financial Crimes Expert (planned).",
    },
  },
  continuity_review: {
    required: [],
    recommended: ["continuity_expert"],
    optional: ["archivist"],
    domains: ["continuity", "series"],
    reasons: {
      continuity_expert: "Continuity review requires Continuity Expert for series canon (planned).",
      archivist: "Archivist supports edition lineage and canon records (planned).",
    },
  },
  word_count_reduction: {
    required: [],
    recommended: ["literary_agent"],
    optional: ["developmental_editor"],
    domains: ["commercial", "pacing"],
    reasons: {
      literary_agent: "Word-count reduction prioritizes cuts with commercial rationale.",
      developmental_editor: "DE supports structural consolidation (planned).",
    },
  },
  series_consistency: {
    required: [],
    recommended: ["continuity_expert", "timeline_expert"],
    optional: ["archivist"],
    domains: ["series", "continuity"],
    reasons: {
      continuity_expert: "Series consistency requires cross-book canon alignment (planned).",
      timeline_expert: "Timeline Expert validates chronology across editions (planned).",
      archivist: "Archivist preserves series canon records (planned).",
    },
  },
  certification_benchmark: {
    required: [],
    recommended: ["literary_agent", "military_expert"],
    optional: [],
    domains: ["commercial", "military"],
    reasons: {
      literary_agent: "Certified Literary Agent included per benchmark spec.",
      military_expert: "Military Expert included when benchmark covers operational realism.",
    },
  },
  custom: {
    required: [],
    recommended: [],
    optional: [],
    domains: [],
    reasons: {},
  },
};

function bucketEntry(
  entry: ExpertPlanEntry,
  buckets: {
    required: ExpertPlanEntry[];
    recommended: ExpertPlanEntry[];
    optional: ExpertPlanEntry[];
    declined: ExpertPlanEntry[];
    unavailable: ExpertPlanEntry[];
    experimental: ExpertPlanEntry[];
    blocked: ExpertPlanEntry[];
  },
) {
  switch (entry.tier) {
    case "required":
      buckets.required.push(entry);
      break;
    case "recommended":
      buckets.recommended.push(entry);
      break;
    case "optional":
      buckets.optional.push(entry);
      break;
    case "declined":
      buckets.declined.push(entry);
      break;
    case "unavailable":
      buckets.unavailable.push(entry);
      break;
    case "experimental":
      buckets.experimental.push(entry);
      break;
    case "blocked":
      buckets.blocked.push(entry);
      break;
  }
}

export function buildDeterministicEicPlan(input: {
  intent: AuthorIntentRecord;
  seriesContext?: string | null;
  publicationContext?: string | null;
}): EicEditorialPlanV1 {
  const { intent } = input;
  const mapping = INTENT_MAP[intent.intent_type];
  const reasons: Record<string, string> = { ...mapping.reasons };

  const buckets = {
    required: [] as ExpertPlanEntry[],
    recommended: [] as ExpertPlanEntry[],
    optional: [] as ExpertPlanEntry[],
    declined: [] as ExpertPlanEntry[],
    unavailable: [] as ExpertPlanEntry[],
    experimental: [] as ExpertPlanEntry[],
    blocked: [] as ExpertPlanEntry[],
  };

  const declinedSet = new Set(intent.declined_experts);
  const requestedSet = new Set(intent.requested_experts);

  const allSuggested = new Set([
    ...mapping.required,
    ...mapping.recommended,
    ...mapping.optional,
    ...intent.requested_experts,
  ]);

  for (const key of allSuggested) {
    if (declinedSet.has(key)) {
      bucketEntry(
        buildEntry(key, "declined", reasons[key] ?? "Declined by author."),
        buckets,
      );
      continue;
    }

    let planTier: ExpertPlanTier = "recommended";
    if (mapping.required.includes(key)) planTier = "required";
    else if (mapping.optional.includes(key)) planTier = "optional";
    else if (requestedSet.has(key)) planTier = "recommended";

    const entry = buildEntry(key, planTier, reasons[key] ?? "Requested by author.");
    bucketEntry(entry, buckets);
  }

  for (const key of intent.declined_experts) {
    if (!allSuggested.has(key)) {
      bucketEntry(
        buildEntry(key, "declined", "Declined by author."),
        buckets,
      );
    }
  }

  const domains = [...new Set([...mapping.domains, ...intent.priority_domains])];

  let costRange: string | null = null;
  let runtimeRange: string | null = null;
  const allEntries = [
    ...buckets.required,
    ...buckets.recommended,
    ...buckets.experimental,
  ];
  if (allEntries.length > 0) {
    runtimeRange = "5–20 minutes per expert (estimates vary)";
    costRange = "Varies by manuscript length and expert count";
  }

  if (intent.intent_type === "custom") {
    return Object.freeze({
      contract_version: EIC_PLAN_CONTRACT_VERSION,
      manuscript_id: intent.manuscript_id,
      manuscript_version_id: intent.manuscript_version_id,
      author_intent_id: intent.id,
      intent_type: intent.intent_type,
      required_experts: Object.freeze([]),
      recommended_experts: Object.freeze([]),
      optional_experts: Object.freeze([]),
      declined_experts: Object.freeze(buckets.declined),
      unavailable_experts: Object.freeze([]),
      experimental_experts: Object.freeze([]),
      blocked_experts: Object.freeze([]),
      recommendation_reasons: Object.freeze({
        _custom:
          intent.custom_objective_text ??
          "Custom intent — no silent expert selection. Author must confirm editorial team.",
      }),
      estimated_cost_range: null,
      estimated_runtime_range: null,
      domain_coverage: Object.freeze(intent.priority_domains),
      series_context: input.seriesContext ?? null,
      publication_context: input.publicationContext ?? null,
    });
  }

  return Object.freeze({
    contract_version: EIC_PLAN_CONTRACT_VERSION,
    manuscript_id: intent.manuscript_id,
    manuscript_version_id: intent.manuscript_version_id,
    author_intent_id: intent.id,
    intent_type: intent.intent_type,
    required_experts: Object.freeze(buckets.required),
    recommended_experts: Object.freeze(buckets.recommended),
    optional_experts: Object.freeze(buckets.optional),
    declined_experts: Object.freeze(buckets.declined),
    unavailable_experts: Object.freeze(buckets.unavailable),
    experimental_experts: Object.freeze(buckets.experimental),
    blocked_experts: Object.freeze(buckets.blocked),
    recommendation_reasons: Object.freeze(reasons),
    estimated_cost_range: costRange,
    estimated_runtime_range: runtimeRange,
    domain_coverage: Object.freeze(domains),
    series_context: input.seriesContext ?? null,
    publication_context: input.publicationContext ?? null,
  });
}

export function intentTypeHasRecommendations(intentType: AuthorIntentType): boolean {
  return intentType !== "custom";
}
