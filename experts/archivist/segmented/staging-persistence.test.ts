import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createStagingSegmentedPersistence } from "./staging-persistence.ts";
import type { SegmentedCostLedgerRow } from "./persistence.ts";
import type { SegmentCheckpoint } from "./types.ts";

const ALLOWED_TABLES = new Set([
  "archivist_segmented_workflows",
  "archivist_segment_plans",
  "archivist_segment_checkpoints",
  "archivist_segment_observations",
  "archivist_book_graphs",
  "archivist_coverage_reports",
  "archivist_candidate_reviews",
  "archivist_segmented_cost_ledger",
]);

function fakeClient() {
  const writes: Array<{ table: string; op: string; row: unknown }> = [];
  return {
    writes,
    from(table: string) {
      const record = (op: string, row: unknown) => {
        writes.push({ table, op, row });
      };
      const chain = {
        insert(row: unknown) {
          record("insert", row);
          return chain;
        },
        upsert(row: unknown) {
          record("upsert", row);
          return { error: null };
        },
        update(row: unknown) {
          record("update", row);
          return chain;
        },
        select() {
          return chain;
        },
        eq() {
          return chain;
        },
        in() {
          return chain;
        },
        single() {
          return Promise.resolve({
            data: {
              id: "11111111-1111-1111-1111-111111111111",
              manuscript_id: "ms",
              manuscript_version_id: "mv",
              content_hash: "a".repeat(64),
              archivist_version: "v1",
              archivist_definition_hash: "h",
              status: "running",
              authorized_to_run: false,
            },
            error: null,
          });
        },
        maybeSingle() {
          return Promise.resolve({ data: { id: "cp-1" }, error: null });
        },
        then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
          return Promise.resolve(resolve({ data: [], error: null }));
        },
      };
      return chain;
    },
  };
}

describe("staging segmented persistence adapter", () => {
  it("writes only 0026 tables and never accepted canon", async () => {
    const client = fakeClient();
    const persistence = createStagingSegmentedPersistence(client as never);
    const workflow = await persistence.createWorkflow({
      manuscript_id: "4bd68788-6e4e-415f-84f6-b63e87cc2f52",
      manuscript_version_id: "ad064381-b754-4669-8458-74f040d8bab3",
      content_hash: "d901d178fa03e526d1f1248f313650b4455f2c9b21dded7904fc40d24714b503",
      archivist_version: "v1",
      archivist_definition_hash: "hash",
      status: "running",
      authorized_to_run: false,
    });
    assert.equal(workflow.authorized_to_run, false);
    await persistence.saveCostLedger(workflow.id, []);
    const checkpoint = {
      segment_id: "seg-01",
      status: "validated",
      manuscript_id: workflow.manuscript_id,
      manuscript_version_id: workflow.manuscript_version_id,
      content_hash: workflow.content_hash,
      archivist_version: "v1",
      archivist_definition_hash: "hash",
      segment_contract_version: "archivist_segment_observation@v1",
      plan_fingerprint: "fp",
      segment_source_hash: "sh",
      start_offset: 0,
      end_offset: 10,
      provider: "anthropic",
      model: "claude-haiku-4-5-20251001",
      repair_used: false,
    } as SegmentCheckpoint;
    await persistence.saveCheckpoints(workflow.id, [checkpoint]);
    await persistence.saveCandidateReview(workflow.id, null, []);
    const tables = new Set(client.writes.map((item) => item.table));
    for (const table of tables) {
      assert.ok(ALLOWED_TABLES.has(table), table);
    }
    assert.equal(tables.has("canon_facts"), false);
    assert.equal(tables.has("series_bible_revisions"), false);
    assert.ok(
      client.writes.some(
        (item) =>
          item.table === "archivist_segmented_workflows" &&
          (item.row as { authorized_to_run?: boolean }).authorized_to_run === false,
      ),
    );
  });

  it("does not insert a $0 rehearsal call as a paid ledger row", async () => {
    const client = fakeClient();
    const persistence = createStagingSegmentedPersistence(client as never);
    await persistence.saveCostLedger("wf", [] as SegmentedCostLedgerRow[]);
    assert.equal(
      client.writes.some((item) => item.table === "archivist_segmented_cost_ledger"),
      false,
    );
  });
});
