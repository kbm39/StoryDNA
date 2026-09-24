/**
 * Segmented Archivist persistence contract.
 * Candidate/draft artifacts only. No accepted-canon writes.
 */

import { randomUUID } from "node:crypto";
import type { ArchivistCanonDelta, ArchivistReview } from "../contracts.ts";
import type { SegmentedCallRole } from "./constants.ts";
import type {
  ArchivistBookGraph,
  ArchivistSegmentObservation,
  FullNovelCoverageReport,
  SegmentCheckpoint,
  SegmentPlan,
} from "./types.ts";

export interface SegmentedCostLedgerRow {
  role: SegmentedCallRole;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  cost_usd: number;
  duration_ms: number;
  status: string;
}

export type SegmentedWorkflowStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface SegmentedWorkflowRecord {
  id: string;
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
  archivist_version: string;
  archivist_definition_hash: string;
  status: SegmentedWorkflowStatus;
  authorized_to_run: false;
}

export interface SegmentedPersistence {
  createWorkflow(row: Omit<SegmentedWorkflowRecord, "id"> & { id?: string }): Promise<SegmentedWorkflowRecord>;
  updateWorkflowStatus(id: string, status: SegmentedWorkflowStatus): Promise<void>;
  getWorkflow(id: string): Promise<SegmentedWorkflowRecord | null>;
  listActiveWorkflows(): Promise<SegmentedWorkflowRecord[]>;
  savePlan(workflowId: string, plan: SegmentPlan): Promise<void>;
  saveCheckpoints(workflowId: string, checkpoints: readonly SegmentCheckpoint[]): Promise<void>;
  loadCheckpoints(workflowId: string): Promise<SegmentCheckpoint[]>;
  saveObservation(
    workflowId: string,
    checkpoint: SegmentCheckpoint,
    observation: ArchivistSegmentObservation,
  ): Promise<void>;
  loadObservations(workflowId: string): Promise<ArchivistSegmentObservation[]>;
  saveBookGraph(workflowId: string, graph: ArchivistBookGraph): Promise<void>;
  saveCoverage(workflowId: string, coverage: FullNovelCoverageReport): Promise<void>;
  saveCandidateReview(
    workflowId: string,
    review: ArchivistReview | null,
    candidateCanon: readonly ArchivistCanonDelta[],
  ): Promise<void>;
  saveCostLedger(workflowId: string, rows: readonly SegmentedCostLedgerRow[]): Promise<void>;
}

export function createMemorySegmentedPersistence(): SegmentedPersistence {
  const workflows = new Map<string, SegmentedWorkflowRecord>();
  const plans = new Map<string, SegmentPlan>();
  const checkpoints = new Map<string, SegmentCheckpoint[]>();
  const observations = new Map<string, ArchivistSegmentObservation[]>();
  const graphs = new Map<string, ArchivistBookGraph>();
  const coverage = new Map<string, FullNovelCoverageReport>();
  const reviews = new Map<string, { review: ArchivistReview | null; candidateCanon: ArchivistCanonDelta[] }>();
  const ledgers = new Map<string, SegmentedCostLedgerRow[]>();

  return {
    async createWorkflow(row) {
      const record: SegmentedWorkflowRecord = {
        ...row,
        id: row.id ?? randomUUID(),
        authorized_to_run: false,
      };
      workflows.set(record.id, record);
      return record;
    },
    async updateWorkflowStatus(id, status) {
      const existing = workflows.get(id);
      if (existing) workflows.set(id, { ...existing, status });
    },
    async getWorkflow(id) {
      return workflows.get(id) ?? null;
    },
    async listActiveWorkflows() {
      return [...workflows.values()].filter((row) => row.status === "pending" || row.status === "running");
    },
    async savePlan(workflowId, plan) {
      plans.set(workflowId, plan);
    },
    async saveCheckpoints(workflowId, rows) {
      checkpoints.set(workflowId, [...rows]);
    },
    async loadCheckpoints(workflowId) {
      return [...(checkpoints.get(workflowId) ?? [])];
    },
    async saveObservation(workflowId, _checkpoint, observation) {
      const current = observations.get(workflowId) ?? [];
      current.push(observation);
      observations.set(workflowId, current);
    },
    async loadObservations(workflowId) {
      return [...(observations.get(workflowId) ?? [])];
    },
    async saveBookGraph(workflowId, graph) {
      graphs.set(workflowId, graph);
    },
    async saveCoverage(workflowId, report) {
      coverage.set(workflowId, report);
    },
    async saveCandidateReview(workflowId, review, candidateCanon) {
      reviews.set(workflowId, { review, candidateCanon: [...candidateCanon] });
    },
    async saveCostLedger(workflowId, rows) {
      ledgers.set(workflowId, [...rows]);
    },
  };
}
