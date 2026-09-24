/**
 * Staging persistence for segmented Archivist rehearsal.
 * Writes only the new 0026 tables. Never writes accepted canon.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArchivistCanonDelta, ArchivistReview } from "../contracts.ts";
import type {
  ArchivistBookGraph,
  ArchivistSegmentObservation,
  FullNovelCoverageReport,
  SegmentCheckpoint,
  SegmentPlan,
} from "./types.ts";
import type {
  SegmentedCostLedgerRow,
  SegmentedPersistence,
  SegmentedWorkflowRecord,
  SegmentedWorkflowStatus,
} from "./persistence.ts";

export function createStagingSegmentedPersistence(client: SupabaseClient): SegmentedPersistence {
  return {
    async createWorkflow(row) {
      const { data, error } = await client
        .from("archivist_segmented_workflows")
        .insert({
          ...(row.id ? { id: row.id } : {}),
          manuscript_id: row.manuscript_id,
          manuscript_version_id: row.manuscript_version_id,
          content_hash: row.content_hash,
          archivist_version: row.archivist_version,
          archivist_definition_hash: row.archivist_definition_hash,
          status: row.status,
          authorized_to_run: false,
        })
        .select("id, manuscript_id, manuscript_version_id, content_hash, archivist_version, archivist_definition_hash, status, authorized_to_run")
        .single();
      if (error || !data) throw new Error(error?.message ?? "workflow insert failed");
      return data as SegmentedWorkflowRecord;
    },
    async updateWorkflowStatus(id, status: SegmentedWorkflowStatus) {
      const { error } = await client
        .from("archivist_segmented_workflows")
        .update({ status })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    async getWorkflow(id) {
      const { data, error } = await client
        .from("archivist_segmented_workflows")
        .select("id, manuscript_id, manuscript_version_id, content_hash, archivist_version, archivist_definition_hash, status, authorized_to_run")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as SegmentedWorkflowRecord | null) ?? null;
    },
    async listActiveWorkflows() {
      const { data, error } = await client
        .from("archivist_segmented_workflows")
        .select("id, manuscript_id, manuscript_version_id, content_hash, archivist_version, archivist_definition_hash, status, authorized_to_run")
        .in("status", ["pending", "running"]);
      if (error) throw new Error(error.message);
      return (data ?? []) as SegmentedWorkflowRecord[];
    },
    async savePlan(workflowId, plan: SegmentPlan) {
      const { error } = await client.from("archivist_segment_plans").insert({
        workflow_id: workflowId,
        planner_version: plan.planner_version,
        plan_fingerprint: plan.plan_fingerprint,
        unit_count: plan.unit_count,
        segment_count: plan.segment_count,
        plan_json: plan,
      });
      if (error) throw new Error(error.message);
    },
    async saveCheckpoints(workflowId, checkpoints: readonly SegmentCheckpoint[]) {
      for (const checkpoint of checkpoints) {
        const { error } = await client.from("archivist_segment_checkpoints").upsert(
          {
            workflow_id: workflowId,
            segment_id: checkpoint.segment_id,
            status: checkpoint.status,
            manuscript_id: checkpoint.manuscript_id,
            manuscript_version_id: checkpoint.manuscript_version_id,
            content_hash: checkpoint.content_hash,
            archivist_version: checkpoint.archivist_version,
            archivist_definition_hash: checkpoint.archivist_definition_hash,
            segment_contract_version: checkpoint.segment_contract_version,
            plan_fingerprint: checkpoint.plan_fingerprint,
            segment_source_hash: checkpoint.segment_source_hash,
            start_offset: checkpoint.start_offset,
            end_offset: checkpoint.end_offset,
            provider: checkpoint.provider,
            model: checkpoint.model,
            error: checkpoint.error ?? null,
            repair_used: checkpoint.repair_used,
          },
          { onConflict: "workflow_id,segment_id" },
        );
        if (error) throw new Error(error.message);
      }
    },
    async loadCheckpoints(workflowId) {
      const { data, error } = await client
        .from("archivist_segment_checkpoints")
        .select("*")
        .eq("workflow_id", workflowId);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        manuscript_id: row.manuscript_id,
        manuscript_version_id: row.manuscript_version_id,
        content_hash: row.content_hash,
        archivist_version: row.archivist_version,
        archivist_definition_hash: row.archivist_definition_hash,
        segment_contract_version: row.segment_contract_version,
        plan_fingerprint: row.plan_fingerprint,
        segment_id: row.segment_id,
        segment_source_hash: row.segment_source_hash,
        start_offset: row.start_offset,
        end_offset: row.end_offset,
        provider: row.provider,
        model: row.model,
        status: row.status,
        error: row.error ?? undefined,
        repair_used: row.repair_used,
      })) as SegmentCheckpoint[];
    },
    async saveObservation(
      workflowId,
      checkpoint: SegmentCheckpoint,
      observation: ArchivistSegmentObservation,
    ) {
      const { data, error: lookupError } = await client
        .from("archivist_segment_checkpoints")
        .select("id")
        .eq("workflow_id", workflowId)
        .eq("segment_id", checkpoint.segment_id)
        .maybeSingle();
      if (lookupError || !data) throw new Error(lookupError?.message ?? "checkpoint missing");
      const { error } = await client.from("archivist_segment_observations").insert({
        workflow_id: workflowId,
        checkpoint_id: data.id,
        segment_id: checkpoint.segment_id,
        contract_version: checkpoint.segment_contract_version,
        observation_json: observation,
      });
      if (error) throw new Error(error.message);
    },
    async loadObservations(workflowId) {
      const { data, error } = await client
        .from("archivist_segment_observations")
        .select("observation_json")
        .eq("workflow_id", workflowId);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => row.observation_json as ArchivistSegmentObservation);
    },
    async saveBookGraph(workflowId, graph: ArchivistBookGraph) {
      const { error } = await client.from("archivist_book_graphs").upsert(
        { workflow_id: workflowId, schema_version: graph.schema, graph_json: graph },
        { onConflict: "workflow_id" },
      );
      if (error) throw new Error(error.message);
    },
    async saveCoverage(workflowId, report: FullNovelCoverageReport) {
      const { error } = await client.from("archivist_coverage_reports").upsert(
        {
          workflow_id: workflowId,
          unique_words_covered: report.unique_words_covered,
          overlap_words: report.overlap_words,
          coverage_percentage: report.coverage_percentage,
          complete: report.complete,
          report_json: report,
        },
        { onConflict: "workflow_id" },
      );
      if (error) throw new Error(error.message);
    },
    async saveCandidateReview(
      workflowId,
      review: ArchivistReview | null,
      candidateCanon: readonly ArchivistCanonDelta[],
    ) {
      const { error } = await client.from("archivist_candidate_reviews").upsert(
        {
          workflow_id: workflowId,
          review_json: review ?? {},
          candidate_canon: candidateCanon,
        },
        { onConflict: "workflow_id" },
      );
      if (error) throw new Error(error.message);
    },
    async saveCostLedger(workflowId, rows: readonly SegmentedCostLedgerRow[]) {
      if (rows.length === 0) return;
      const { error } = await client.from("archivist_segmented_cost_ledger").insert(
        rows.map((row) => ({
          workflow_id: workflowId,
          role: row.role,
          provider: row.provider,
          model: row.model,
          input_tokens: row.input_tokens,
          output_tokens: row.output_tokens,
          cost_usd: row.cost_usd,
          duration_ms: row.duration_ms,
          status: row.status,
        })),
      );
      if (error) throw new Error(error.message);
    },
  };
}
