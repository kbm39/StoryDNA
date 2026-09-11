import type { ParsedCandidate, ParsedIssue } from "@/lib/ai/review-engine.ts";

export const REVISION_CANDIDATE_OUTPUT_SCHEMA = `{"issues":[{"key":"...","text":"...","area":"opening|middle|ending|character|dialogue|pacing|prose|commercial|structure|other","severity":"low|medium|high","source_section":"...","success_criterion":"...","candidates":[{"type":"...","original":"...","revised":"...","locator":"...","word_savings":0,"reason":"...","confidence":0,"confidence_reason":"...","difficulty":"easy|medium|difficult|major_rewrite","story_risk":"low|medium|high","voice_risk":"low|medium|high","commercial_impact":"low|medium|high","reader_impact":"low|medium|high","grade_delta":0,"consequence_if_unchanged":"...","dependencies":"...","impacts":{"pacing":0,"clarity":0,"commercial_readiness":0,"emotional_impact":0,"voice_preservation":0,"submission_readiness":0}}]}]}`;

export type RevisionCandidateExtractMethod =
  | "identity"
  | "fenced"
  | "isolated"
  | "enum_quoted"
  | "none";

export interface RevisionCandidateJsonExtract {
  jsonText: string | null;
  method: RevisionCandidateExtractMethod;
  identityParseOk: boolean;
  deterministicAttempted: boolean;
  deterministicSucceeded: boolean;
}

export interface RevisionCandidateParseDiagnostics {
  first_parse_ok: boolean;
  deterministic_recovery_attempted: boolean;
  deterministic_recovery_succeeded: boolean;
  extract_method: RevisionCandidateExtractMethod;
  schema_ok: boolean;
  parse_error: string | null;
  issue_count: number;
  usage_captured_before_parse: boolean;
  repair_invoked: boolean;
  repair_parse_ok: boolean | null;
  raw_char_length: number;
}

export interface ParseRevisionCandidatesResult {
  issues: ParsedIssue[];
  warnings: string[];
}

export interface ResolvedRevisionCandidates extends ParseRevisionCandidatesResult {
  structuralOk: boolean;
  diagnostics: RevisionCandidateParseDiagnostics;
}

function rcStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function rcInt(v: unknown, lo: number, hi: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : 0;
  if (!isFinite(n)) return 0;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

/** Quote bareword enum values the model sometimes emits (e.g. "difficulty":medium). */
export function quoteBareRevisionCandidateEnums(s: string): string {
  const keys = [
    "type",
    "area",
    "severity",
    "difficulty",
    "story_risk",
    "voice_risk",
    "commercial_impact",
    "reader_impact",
  ];
  let out = s;
  for (const k of keys) {
    out = out.replace(new RegExp(`("${k}"\\s*:\\s*)([A-Za-z_][A-Za-z0-9_]*)`, "g"), '$1"$2"');
  }
  return out;
}

function tryJsonParse(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Isolate the first complete JSON object or array using string-aware brace matching.
 * Does not invent values. Returns null when the value is truncated or absent.
 */
export function isolateFirstJsonValue(source: string): string | null {
  const obj = source.indexOf("{");
  const arr = source.indexOf("[");
  if (obj === -1 && arr === -1) return null;
  const start = arr === -1 || (obj !== -1 && obj < arr) ? obj : arr;
  const rootOpen = source[start];
  const rootClose = rootOpen === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i]!;
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === rootOpen) depth += 1;
    else if (ch === rootClose) {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

function unwrapFence(raw: string): string | null {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fence ? fence[1].trim() : null;
}

/**
 * Safe format-only recovery: fences, first JSON value, trailing-prose isolation,
 * and quoting of bare enum words. Never fabricates issues or fields.
 */
export function extractRevisionCandidateJson(raw: string): RevisionCandidateJsonExtract {
  const trimmed = raw.trim();
  const identity = tryJsonParse(trimmed);
  if (identity !== undefined) {
    return {
      jsonText: trimmed,
      method: "identity",
      identityParseOk: true,
      deterministicAttempted: false,
      deterministicSucceeded: true,
    };
  }

  const fenced = unwrapFence(trimmed);
  if (fenced) {
    if (tryJsonParse(fenced) !== undefined) {
      return {
        jsonText: fenced,
        method: "fenced",
        identityParseOk: false,
        deterministicAttempted: true,
        deterministicSucceeded: true,
      };
    }
    const isolatedFence = isolateFirstJsonValue(fenced);
    if (isolatedFence && tryJsonParse(isolatedFence) !== undefined) {
      return {
        jsonText: isolatedFence,
        method: "isolated",
        identityParseOk: false,
        deterministicAttempted: true,
        deterministicSucceeded: true,
      };
    }
    const quotedFence = isolatedFence
      ? quoteBareRevisionCandidateEnums(isolatedFence)
      : quoteBareRevisionCandidateEnums(fenced);
    if (tryJsonParse(quotedFence) !== undefined) {
      return {
        jsonText: quotedFence,
        method: "enum_quoted",
        identityParseOk: false,
        deterministicAttempted: true,
        deterministicSucceeded: true,
      };
    }
  }

  const isolated = isolateFirstJsonValue(trimmed);
  if (isolated && tryJsonParse(isolated) !== undefined) {
    return {
      jsonText: isolated,
      method: "isolated",
      identityParseOk: false,
      deterministicAttempted: true,
      deterministicSucceeded: true,
    };
  }

  const quoted = quoteBareRevisionCandidateEnums(isolated ?? trimmed);
  if (tryJsonParse(quoted) !== undefined) {
    return {
      jsonText: quoted,
      method: "enum_quoted",
      identityParseOk: false,
      deterministicAttempted: true,
      deterministicSucceeded: true,
    };
  }

  return {
    jsonText: isolated ?? fenced ?? null,
    method: "none",
    identityParseOk: false,
    deterministicAttempted: true,
    deterministicSucceeded: false,
  };
}

function emptyDiagnostics(raw: string): RevisionCandidateParseDiagnostics {
  return {
    first_parse_ok: false,
    deterministic_recovery_attempted: false,
    deterministic_recovery_succeeded: false,
    extract_method: "none",
    schema_ok: false,
    parse_error: null,
    issue_count: 0,
    usage_captured_before_parse: false,
    repair_invoked: false,
    repair_parse_ok: null,
    raw_char_length: raw.length,
  };
}

function mapIssues(parsed: unknown): ParseRevisionCandidatesResult {
  const arr = Array.isArray(parsed) ? parsed : (parsed as { issues?: unknown }).issues;
  if (!Array.isArray(arr)) {
    throw new Error("Model response did not include an issues array.");
  }

  let skippedIssues = 0;
  let skippedCandidates = 0;
  const warnings: string[] = [];

  const issues = arr
    .filter((x) => x && typeof x === "object" && rcStr((x as Record<string, unknown>).text))
    .map((x: Record<string, unknown>) => {
      const cands = Array.isArray(x.candidates) ? x.candidates : [];
      const candidates: ParsedCandidate[] = cands
        .filter((c: unknown): c is Record<string, unknown> => !!c && typeof c === "object")
        .map((c: Record<string, unknown>) => {
          const im = (c.impacts ?? {}) as Record<string, unknown>;
          return {
            type: rcStr(c.type) || "comment_only",
            original: rcStr(c.original),
            revised: rcStr(c.revised),
            locator: rcStr(c.locator),
            word_savings: rcInt(c.word_savings, 0, 100000),
            reason: rcStr(c.reason),
            confidence: rcInt(c.confidence, 0, 100),
            confidence_reason: rcStr(c.confidence_reason),
            difficulty: rcStr(c.difficulty) || "medium",
            story_risk: rcStr(c.story_risk) || "low",
            voice_risk: rcStr(c.voice_risk) || "low",
            commercial_impact: rcStr(c.commercial_impact) || "medium",
            reader_impact: rcStr(c.reader_impact) || "medium",
            grade_delta: rcInt(c.grade_delta, 0, 20),
            consequence_if_unchanged: rcStr(c.consequence_if_unchanged),
            dependencies: rcStr(c.dependencies),
            impacts: {
              pacing: rcInt(im.pacing, -2, 2),
              clarity: rcInt(im.clarity, -2, 2),
              commercial_readiness: rcInt(im.commercial_readiness, -2, 2),
              emotional_impact: rcInt(im.emotional_impact, -2, 2),
              voice_preservation: rcInt(im.voice_preservation, -2, 2),
              submission_readiness: rcInt(im.submission_readiness, -2, 2),
            },
          };
        })
        .filter((c) => {
          if (!c.original) {
            skippedCandidates += 1;
            return false;
          }
          return true;
        });
      return {
        key: rcStr(x.key),
        text: rcStr(x.text),
        area: rcStr(x.area) || "other",
        severity: rcStr(x.severity) || "medium",
        source_section: rcStr(x.source_section),
        success_criterion: rcStr(x.success_criterion),
        candidates,
      };
    });

  skippedIssues = arr.length - issues.length;
  if (skippedIssues > 0) {
    warnings.push(`Skipped ${skippedIssues} issue(s) missing required text.`);
  }
  if (skippedCandidates > 0) {
    warnings.push(
      `Skipped ${skippedCandidates} candidate(s) missing a verbatim original passage.`,
    );
  }

  return { issues, warnings };
}

/** Defensively parse the revision-candidate JSON. Throws on unrecoverable format defects. */
export function parseRevisionCandidates(raw: string): ParseRevisionCandidatesResult {
  const extracted = extractRevisionCandidateJson(raw);
  if (!extracted.jsonText) {
    throw new Error("Could not parse revision-candidate JSON from the model response.");
  }
  const parsed: unknown = tryJsonParse(extracted.jsonText);
  if (parsed === undefined) {
    throw new Error("Could not parse revision-candidate JSON from the model response.");
  }
  if (extracted.method === "enum_quoted") {
    const warningsHolder = mapIssues(parsed);
    warningsHolder.warnings.unshift("Repaired unquoted enum values in model JSON.");
    return warningsHolder;
  }
  return mapIssues(parsed);
}

export function resolveRevisionCandidates(
  raw: string,
  extras?: Partial<Pick<RevisionCandidateParseDiagnostics, "usage_captured_before_parse" | "repair_invoked" | "repair_parse_ok">>,
): ResolvedRevisionCandidates {
  const extracted = extractRevisionCandidateJson(raw);
  const diagnostics: RevisionCandidateParseDiagnostics = {
    ...emptyDiagnostics(raw),
    first_parse_ok: extracted.identityParseOk,
    deterministic_recovery_attempted: extracted.deterministicAttempted,
    deterministic_recovery_succeeded: extracted.deterministicSucceeded,
    extract_method: extracted.method,
    usage_captured_before_parse: extras?.usage_captured_before_parse ?? false,
    repair_invoked: extras?.repair_invoked ?? false,
    repair_parse_ok: extras?.repair_parse_ok ?? null,
  };

  try {
    const parsed = parseRevisionCandidates(raw);
    diagnostics.schema_ok = true;
    diagnostics.issue_count = parsed.issues.length;
    diagnostics.parse_error = null;
    if (extracted.method === "enum_quoted" && !parsed.warnings.some((w) => w.includes("unquoted enum"))) {
      parsed.warnings.unshift("Repaired unquoted enum values in model JSON.");
    }
    return {
      structuralOk: true,
      issues: parsed.issues,
      warnings: parsed.warnings,
      diagnostics,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    diagnostics.schema_ok = !message.includes("issues array") ? diagnostics.schema_ok : false;
    diagnostics.parse_error = message;
    diagnostics.issue_count = 0;
    return {
      structuralOk: false,
      issues: [],
      warnings: [],
      diagnostics,
    };
  }
}

export function buildRevisionCandidatesRepairPrompt(args: {
  malformedRaw: string;
  parseError: string;
}): string {
  return `You repair INVALID revision-candidate JSON so it becomes strict, valid JSON matching this schema exactly.

Return ONLY the JSON object. No markdown. No surrounding prose.

Schema:
${REVISION_CANDIDATE_OUTPUT_SCHEMA}

Rules:
- Repair representation and structure only.
- Do not change editorial conclusions, issue meaning, or candidate meaning.
- Do not invent issues, candidates, original passages, or required fields that were not present.
- If an issue or candidate cannot be represented without fabricating content, omit it.
- Every string value must be double-quoted. Numbers are unquoted.

Parse error:
${args.parseError}

Malformed response:
${args.malformedRaw}`;
}
