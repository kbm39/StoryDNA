import { createHash } from "node:crypto";
import { chapterOrdinalFromLocator } from "../../comparison-key.ts";
import { canonicalizeTypographicPunctuation } from "../unicode-punctuation-equivalence.ts";
import type { V2Observation } from "../types.ts";
import type { Phase1ReviewReason } from "./types.ts";

export function normalizeExcerptIdentity(excerpt: string): string {
  return canonicalizeTypographicPunctuation(excerpt).toLowerCase().replace(/\s+/g, " ").trim();
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function evidenceIdentityFromLocatorAndExcerpt(locator: string, excerpt: string): string {
  return `${locator.trim()}|${sha256Hex(normalizeExcerptIdentity(excerpt))}`;
}

export function evidenceIdentity(observation: V2Observation): string {
  return evidenceIdentityFromLocatorAndExcerpt(observation.evidence.locator, observation.evidence.excerpt);
}

export function passageDecisionKey(args: {
  manuscriptId: string;
  manuscriptVersionId: string;
  evidenceIdentity: string;
}): string {
  return sha256Hex([args.manuscriptId, args.manuscriptVersionId, args.evidenceIdentity].join("\n"));
}

export function evidenceSortKey(observation: V2Observation): [number, string, string] {
  const ordinal =
    chapterOrdinalFromLocator(observation.evidence.locator) ??
    chapterOrdinalFromLocator(observation.evidence.source_segment);
  return [ordinal ?? Number.POSITIVE_INFINITY, observation.evidence.locator, evidenceIdentity(observation)];
}

export function clusterKey(args: {
  manuscriptId: string;
  entityKey: string;
  domain: string;
  topicKey: string;
  reason: Phase1ReviewReason;
}): string {
  return [args.manuscriptId, args.entityKey, args.domain, args.topicKey, args.reason].join("|");
}

export function reviewFingerprint(args: {
  manuscriptId: string;
  manuscriptVersionId: string;
  domain: string;
  reason: Phase1ReviewReason;
  entityKey: string;
  topicKey: string;
  evidenceIdentities: readonly string[];
}): string {
  const evidence = [...new Set(args.evidenceIdentities)].sort();
  return sha256Hex(
    [
      args.manuscriptId,
      args.manuscriptVersionId,
      args.domain,
      args.reason,
      args.entityKey,
      args.topicKey,
      ...evidence,
    ].join("\n"),
  );
}
