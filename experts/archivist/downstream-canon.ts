/**
 * How future experts consume Archivist canon. Archivist remains the canon
 * authority service; consumers read, they do not author canon.
 */

import {
  DEVELOPMENTAL_CANON_QUERY_FACT_TYPES,
  MILITARY_CANON_QUERY_FACT_TYPES,
  type CanonFactType,
  type CanonQuery,
} from "@/lib/canon/types.ts";

export const ARCHIVIST_CANON_AUTHORITY_SERVICE = "archivist" as const;

export const POLICE_MOB_CANON_QUERY_FACT_TYPES = [
  "rank_title",
  "location",
  "relationship",
  "possession",
  "chronology",
  "alive_status",
] as const satisfies readonly CanonFactType[];

export interface DownstreamCanonConsumer {
  expert_key: string;
  role: "reader";
  may_author_canon: false;
  fact_types: readonly CanonFactType[];
  include_unresolved_conflicts: boolean;
  notes: string;
}

export const MILITARY_EXPERT_CANON_CONSUMER: DownstreamCanonConsumer = {
  expert_key: "military_expert",
  role: "reader",
  may_author_canon: false,
  fact_types: MILITARY_CANON_QUERY_FACT_TYPES,
  include_unresolved_conflicts: false,
  notes:
    "Military Expert may request rank/title, training/knowledge, age, injuries, weapons/equipment possession, chronology, and location. It must not create authoritative canon.",
};

export const DEVELOPMENTAL_EDITOR_CANON_CONSUMER: DownstreamCanonConsumer = {
  expert_key: "developmental_editor",
  role: "reader",
  may_author_canon: false,
  fact_types: DEVELOPMENTAL_CANON_QUERY_FACT_TYPES,
  include_unresolved_conflicts: true,
  notes:
    "Developmental Editor may request timeline, relationships, character history, and unresolved conflicts. It must not create authoritative canon.",
};

export const POLICE_CANON_CONSUMER: DownstreamCanonConsumer = {
  expert_key: "police_expert",
  role: "reader",
  may_author_canon: false,
  fact_types: POLICE_MOB_CANON_QUERY_FACT_TYPES,
  include_unresolved_conflicts: false,
  notes: "Police Expert reads the same canon layer. It does not create authoritative canon.",
};

export const MOB_CANON_CONSUMER: DownstreamCanonConsumer = {
  expert_key: "organized_crime_expert",
  role: "reader",
  may_author_canon: false,
  fact_types: POLICE_MOB_CANON_QUERY_FACT_TYPES,
  include_unresolved_conflicts: false,
  notes: "Mob Expert reads the same canon layer. It does not create authoritative canon.",
};

export const ARCHIVIST_DOWNSTREAM_CANON_CONTRACT = {
  authority_service: ARCHIVIST_CANON_AUTHORITY_SERVICE,
  consumers: {
    military_expert: MILITARY_EXPERT_CANON_CONSUMER,
    developmental_editor: DEVELOPMENTAL_EDITOR_CANON_CONSUMER,
    police_expert: POLICE_CANON_CONSUMER,
    organized_crime_expert: MOB_CANON_CONSUMER,
  },
} as const;

export function militaryCanonQuery(args: {
  series_id?: string | null;
  manuscript_id?: string;
}): CanonQuery {
  return {
    series_id: args.series_id,
    as_of_manuscript_id: args.manuscript_id,
    fact_types: MILITARY_CANON_QUERY_FACT_TYPES,
    statuses: ["accepted"],
  };
}

export function developmentalCanonQuery(args: {
  series_id?: string | null;
  manuscript_id?: string;
}): CanonQuery {
  return {
    series_id: args.series_id,
    as_of_manuscript_id: args.manuscript_id,
    fact_types: DEVELOPMENTAL_CANON_QUERY_FACT_TYPES,
    statuses: ["accepted"],
  };
}

export function policeMobCanonQuery(args: {
  series_id?: string | null;
  manuscript_id?: string;
}): CanonQuery {
  return {
    series_id: args.series_id,
    as_of_manuscript_id: args.manuscript_id,
    fact_types: POLICE_MOB_CANON_QUERY_FACT_TYPES,
    statuses: ["accepted"],
  };
}
