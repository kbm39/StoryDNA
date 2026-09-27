import { chapterOrdinalFromLocator } from "../../comparison-key.ts";
import { v2ObservationEntityKey } from "../entity-resolution.ts";
import type { V2Observation } from "../types.ts";
import { diagnoseNamespacedPair, injuryTopicKey, isPhase1ReviewEligiblePair } from "./eligibility.ts";
import { clusterKey, evidenceIdentity, evidenceSortKey, passageDecisionKey, reviewFingerprint } from "./fingerprint.ts";
import { countReviewStates, summarizeClusterReviewStatus } from "./decisions.ts";
import type {
  ArchivistReviewCandidate,
  ArchivistReviewDecisionStore,
  ArchivistReviewEvidenceSide,
  ArchivistReviewState,
  Phase1ReviewReason,
} from "./types.ts";
import { ENGINE_ELIGIBILITY_PRESERVED } from "./types.ts";

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function uniqueEvidence(args: {
  observations: readonly V2Observation[];
  manuscriptId: string;
  manuscriptVersionId: string;
  decisions?: ArchivistReviewDecisionStore;
}): ArchivistReviewEvidenceSide[] {
  const seen = new Set<string>();
  const rows: ArchivistReviewEvidenceSide[] = [];
  const sorted = [...args.observations].sort((a, b) => {
    const [oa, la, ia] = evidenceSortKey(a);
    const [ob, lb, ib] = evidenceSortKey(b);
    if (oa !== ob) return oa - ob;
    if (la !== lb) return la.localeCompare(lb);
    return ia.localeCompare(ib);
  });
  for (const observation of sorted) {
    const identity = evidenceIdentity(observation);
    if (seen.has(identity)) continue;
    seen.add(identity);
    const passageKey = passageDecisionKey({
      manuscriptId: args.manuscriptId,
      manuscriptVersionId: args.manuscriptVersionId,
      evidenceIdentity: identity,
    });
    const reviewState: ArchivistReviewState = args.decisions?.get(passageKey)?.review_state ?? "pending";
    rows.push({
      locator: observation.evidence.locator.trim(),
      excerpt: observation.evidence.excerpt.trim(),
      evidence_identity: identity,
      passage_key: passageKey,
      chapter_ordinal: chapterOrdinalFromLocator(observation.evidence.locator),
      review_state: reviewState,
    });
  }
  return rows;
}

export function collectPhase1ReviewCandidates(args: {
  observations: readonly V2Observation[];
  manuscriptId: string;
  manuscriptVersionId: string;
  sourceWorkflowId?: string | null;
  decisions?: ArchivistReviewDecisionStore;
}): ArchivistReviewCandidate[] {
  const clusters = new Map<
    string,
    {
      entityKey: string;
      topicKey: string;
      reason: Phase1ReviewReason;
      pairCount: number;
      observations: V2Observation[];
    }
  >();

  for (let i = 0; i < args.observations.length; i++) {
    for (let j = i + 1; j < args.observations.length; j++) {
      const { left, right, diagnosis } = diagnoseNamespacedPair(
        args.observations[i]!,
        args.observations[j]!,
      );
      if (!isPhase1ReviewEligiblePair(left, right, diagnosis)) continue;
      const entityKey = v2ObservationEntityKey(left);
      const topicKey = injuryTopicKey(left);
      if (!entityKey || !topicKey) continue;
      const reason = diagnosis.reason as Phase1ReviewReason;
      const key = clusterKey({
        manuscriptId: args.manuscriptId,
        entityKey,
        domain: "injury_state",
        topicKey,
        reason,
      });
      const current = clusters.get(key) ?? {
        entityKey,
        topicKey,
        reason,
        pairCount: 0,
        observations: [],
      };
      current.pairCount += 1;
      current.observations.push(left, right);
      clusters.set(key, current);
    }
  }

  return [...clusters.values()].map((cluster) => {
    const evidence = uniqueEvidence({
      observations: cluster.observations,
      manuscriptId: args.manuscriptId,
      manuscriptVersionId: args.manuscriptVersionId,
      decisions: args.decisions,
    });
    const fingerprint = reviewFingerprint({
      manuscriptId: args.manuscriptId,
      manuscriptVersionId: args.manuscriptVersionId,
      domain: "injury_state",
      reason: cluster.reason,
      entityKey: cluster.entityKey,
      topicKey: cluster.topicKey,
      evidenceIdentities: evidence.map((row) => row.evidence_identity),
    });
    const states = evidence.map((row) => row.review_state);
    return {
      fingerprint,
      cluster_key: clusterKey({
        manuscriptId: args.manuscriptId,
        entityKey: cluster.entityKey,
        domain: "injury_state",
        topicKey: cluster.topicKey,
        reason: cluster.reason,
      }),
      manuscript_id: args.manuscriptId,
      manuscript_version_id: args.manuscriptVersionId,
      source_workflow_id: args.sourceWorkflowId ?? null,
      domain: "injury_state",
      topic_key: cluster.topicKey,
      entity_key: cluster.entityKey,
      entity_label: titleCase(cluster.entityKey),
      topic_label: titleCase(cluster.topicKey),
      reason: cluster.reason,
      engine_eligibility: ENGINE_ELIGIBILITY_PRESERVED,
      pair_count: cluster.pairCount,
      evidence,
      status_counts: countReviewStates(states),
      status_summary: summarizeClusterReviewStatus(states),
    };
  });
}
