/**
 * Formal Archivist certification checkpoint.
 *
 * Certifies the complete StoryDNA Archivist pipeline on freeze SHA
 * 7a90ea6a7815948ce2d5e0f3351f66f3826b3a94 after archivist-cert-20260924-v4.
 *
 * Does not certify raw Haiku accuracy.
 * Does not authorize execution, runtime, Studio, Production, or a real manuscript.
 */

import { ARCHIVIST_VERSION } from "./contracts.ts";
import { ARCHIVIST_CONSTITUTION_DEFINITION_HASH } from "./constitution-hash.ts";
import { ARCHIVIST_REGISTRY_DEFINITION_HASH } from "./registry-definition.ts";
import { archivistRuntimeDefinition } from "./runtime-definition.ts";
import { ARCHIVIST_CERT_20260924_V4_EVIDENCE } from "./session-archivist-cert-20260924-v4.ts";
import {
  ARCHIVIST_LIVE_MODEL_CERTIFIED,
  ARCHIVIST_LIVE_MODEL_CERTIFIED_SEMANTICS,
} from "./live-flags.ts";

export const ARCHIVIST_CERTIFIED_CODE_SHA =
  "7a90ea6a7815948ce2d5e0f3351f66f3826b3a94" as const;

export const ARCHIVIST_CERTIFICATION_OBJECT =
  "full_archivist_pipeline" as const;

export const ARCHIVIST_RAW_MODEL_CERTIFIED = false as const;

export const ARCHIVIST_CERTIFICATION_HISTORY = {
  "archivist-smoke-20260922-v1": "structured-output failure",
  "archivist-smoke-20260922-v2": "entity/temporal contract failure",
  "archivist-smoke-20260922-v3": "3/3 PASS",
  "archivist-cert-20260924-v1": "12/15 FAIL",
  "archivist-cert-20260924-v2": "12/15 FAIL",
  "archivist-cert-20260924-v3": "13/15 FAIL",
  "archivist-cert-20260924-v4": "15/15 PASS",
} as const;

export const ARCHIVIST_FORMAL_CERTIFICATION_RECORD = {
  expert: "archivist",
  expert_version: ARCHIVIST_VERSION,
  constitution_definition_hash: ARCHIVIST_CONSTITUTION_DEFINITION_HASH,
  registry_definition_hash: ARCHIVIST_REGISTRY_DEFINITION_HASH,
  runtime_definition_hash: archivistRuntimeDefinition().runtime_versions.definition_hash,
  provider: "Anthropic",
  model: "claude-haiku-4-5-20251001",
  code_sha: ARCHIVIST_CERTIFIED_CODE_SHA,
  suite: ARCHIVIST_CERT_20260924_V4_EVIDENCE.session_id,
  official: ARCHIVIST_CERT_20260924_V4_EVIDENCE.official_result,
  certified_object: ARCHIVIST_CERTIFICATION_OBJECT,
  raw_model_certified: ARCHIVIST_RAW_MODEL_CERTIFIED,
  live_model_certified_semantics: ARCHIVIST_LIVE_MODEL_CERTIFIED_SEMANTICS,
  live_model_certified: ARCHIVIST_LIVE_MODEL_CERTIFIED,
  model_detection: ARCHIVIST_CERT_20260924_V4_EVIDENCE.raw_model_detection,
  final_storydna_detection: ARCHIVIST_CERT_20260924_V4_EVIDENCE.final_storydna_detection,
  false_promotions: ARCHIVIST_CERT_20260924_V4_EVIDENCE.false_promotions,
  false_downgrades: ARCHIVIST_CERT_20260924_V4_EVIDENCE.false_downgrades,
  structured_output: ARCHIVIST_CERT_20260924_V4_EVIDENCE.structured_output_valid,
  repair_calls: ARCHIVIST_CERT_20260924_V4_EVIDENCE.repair_calls,
  confirmed_evidence_compliance: "100%",
  canon_safety: "PASS",
  ambiguity_safety: "PASS",
  retcon_handling: "PASS",
  temporal_controls: "PASS",
  canon_writes: ARCHIVIST_CERT_20260924_V4_EVIDENCE.canon_writes,
  cost_usd: ARCHIVIST_CERT_20260924_V4_EVIDENCE.total_cost_usd,
  execution_wired: false,
  runtime_enabled: false,
  studio_selectable: false,
  production_authorized: false,
  real_manuscript_authorized: false,
  hold_fast_authorized: false,
  history: ARCHIVIST_CERTIFICATION_HISTORY,
} as const;

export const ARCHIVIST_CERTIFICATION_SAFETY_GATES = {
  zero_accepted_canon_writes: true,
  model_cannot_establish_canonical_entity_identity: true,
  model_cannot_elevate_canon_authority: true,
  ambiguous_entities_do_not_silently_merge: true,
  confirmed_requires_both_side_evidence: true,
  valid_temporal_transitions_do_not_confirm: true,
  approved_retcons_do_not_confirm: true,
  one_sided_evidence_cannot_confirm: true,
  unsafe_canon_attempts_fail_closed: true,
  malformed_optional_candidate_cannot_erase_valid_finding: true,
  no_uncontrolled_repair_loop: true,
} as const;
