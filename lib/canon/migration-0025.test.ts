import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SQL_0025 = readFileSync(join(ROOT, "supabase/migrations/0025_archivist_canon.sql"), "utf8");
const SQL_0024 = readFileSync(join(ROOT, "supabase/migrations/0024_expert_registry.sql"), "utf8");

function names(sql: string, pattern: RegExp): string[] {
  return [...sql.matchAll(pattern)].map((match) => match[1]).sort();
}

describe("migration 0025 archivist canon (static)", () => {
  it("is additive and does not mutate 0024 or manuscript/review content", () => {
    assert.match(SQL_0025, /Independent of Expert Registry identity tables \(0024\)/);
    assert.doesNotMatch(SQL_0025, /alter table public\.(manuscripts|manuscript_versions|reviews|editorial_workflows|story_dna|experts|expert_versions)\b/i);
    assert.doesNotMatch(SQL_0025, /drop table/i);
    assert.doesNotMatch(SQL_0025, /truncate /i);
    assert.doesNotMatch(SQL_0025, /delete from /i);
    assert.doesNotMatch(SQL_0025, /story_dna\.data/);
    assert.doesNotMatch(SQL_0025, /expert_versions\.definition/);
    assert.match(SQL_0024, /create table if not exists public\.experts/);
  });

  it("creates the expected tables", () => {
    assert.deepEqual(names(SQL_0025, /create table if not exists public\.(\w+)/g), [
      "canon_conflict_events",
      "canon_conflicts",
      "canon_entities",
      "canon_entity_aliases",
      "canon_evidence",
      "canon_fact_transitions",
      "canon_facts",
      "series_bible_revision_facts",
      "series_bible_revisions",
    ]);
  });

  it("enables RLS and revokes anon/authenticated writes", () => {
    const tables = names(SQL_0025, /create table if not exists public\.(\w+)/g);
    for (const table of tables) {
      assert.match(SQL_0025, new RegExp(`alter table public\\.${table} enable row level security`));
      assert.match(SQL_0025, new RegExp(`revoke insert, update, delete on public\\.${table} from anon, authenticated`));
      assert.match(SQL_0025, new RegExp(`create policy ${table}_select_anon on public\\.${table}`));
    }
  });

  it("uses restrict on historical evidence and facts", () => {
    assert.match(SQL_0025, /source_manuscript_id\s+uuid not null references public\.manuscripts\(id\)\s+on delete restrict/);
    assert.match(SQL_0025, /constraint canon_facts_version_belongs_to_manuscript[\s\S]*on delete restrict/);
    assert.match(SQL_0025, /superseded_by_fact_id\s+uuid null references public\.canon_facts\(id\) on delete restrict/);
    assert.match(SQL_0025, /from_fact_id\s+uuid not null references public\.canon_facts\(id\) on delete restrict/);
    assert.match(SQL_0025, /manuscript_id\s+uuid not null references public\.manuscripts\(id\) on delete restrict/);
    assert.match(SQL_0025, /constraint canon_evidence_version_belongs_to_manuscript[\s\S]*on delete restrict/);
    assert.match(SQL_0025, /fact_id\s+uuid not null references public\.canon_facts\(id\) on delete restrict/);
  });

  it("blocks extraction from inserting accepted canon", () => {
    assert.match(SQL_0025, /EXTRACTION_CANNOT_ACCEPT_CANON/);
    assert.match(SQL_0025, /ACCEPTED_CANON_REQUIRES_AUTHOR/);
    assert.match(SQL_0025, /INFERRED_CANNOT_BECOME_CANON/);
    assert.match(SQL_0025, /IMMUTABLE_ACCEPTED_CANON/);
    assert.match(SQL_0025, /First-book extraction does NOT insert revision 1/);
  });

  it("encodes the documented authority hierarchy as text, not magic integers", () => {
    assert.match(SQL_0025, /author_approved_exception/);
    assert.match(SQL_0025, /series_bible_accepted/);
    assert.match(SQL_0025, /prior_volume_canon/);
    assert.match(SQL_0025, /current_observation/);
    assert.match(SQL_0025, /uncertain_observation/);
    assert.doesNotMatch(SQL_0025, /authority\s+int/);
    assert.match(SQL_0025, /numeric rank lives in\s+-- lib\/canon\/authority\.ts/s);
  });

  it("declares lookup indexes, uniqueness, functions, and triggers", () => {
    assert.deepEqual(names(SQL_0025, /create (?:unique )?index if not exists (\w+)/g), [
      "canon_conflict_events_conflict_idx",
      "canon_conflicts_classification_idx",
      "canon_conflicts_current_fact_idx",
      "canon_conflicts_manuscript_idx",
      "canon_conflicts_series_idx",
      "canon_entities_series_idx",
      "canon_entities_standalone_idx",
      "canon_entities_type_idx",
      "canon_entity_aliases_series_alias_idx",
      "canon_entity_aliases_standalone_alias_idx",
      "canon_evidence_conflict_idx",
      "canon_evidence_fact_idx",
      "canon_evidence_version_idx",
      "canon_fact_transitions_from_idx",
      "canon_fact_transitions_to_idx",
      "canon_facts_authority_idx",
      "canon_facts_entity_idx",
      "canon_facts_series_idx",
      "canon_facts_source_manuscript_idx",
      "canon_facts_superseded_by_idx",
      "canon_facts_type_status_idx",
      "series_bible_revision_facts_fact_idx",
      "series_bible_revisions_one_accepted_per_series",
      "series_bible_revisions_series_idx",
    ]);
    assert.match(SQL_0025, /constraint canon_entity_aliases_unique_per_entity unique \(entity_id, alias_normalized\)/);
    assert.match(SQL_0025, /constraint series_bible_revisions_unique_number unique \(series_id, revision_number\)/);
    assert.deepEqual(names(SQL_0025, /create or replace function public\.(\w+)/g), [
      "canon_entity_aliases_sync_scope",
      "canon_facts_immutability_guard",
    ]);
    assert.deepEqual(names(SQL_0025, /create trigger (\w+)/g), [
      "canon_conflicts_set_updated_at",
      "canon_entities_set_updated_at",
      "canon_entity_aliases_sync_scope",
      "canon_facts_immutability",
      "canon_facts_set_updated_at",
      "series_bible_revisions_set_updated_at",
    ]);
  });

  it("does not unique aliases across a series/standalone scope", () => {
    assert.doesNotMatch(SQL_0025, /canon_entity_aliases_series_alias_unique/);
    assert.doesNotMatch(SQL_0025, /canon_entity_aliases_standalone_alias_unique/);
    assert.doesNotMatch(
      SQL_0025,
      /create unique index if not exists canon_entity_aliases_\w+_alias_unique/,
    );
  });

  it("does not unique time-varying accepted facts by book_order", () => {
    assert.doesNotMatch(SQL_0025, /canon_facts_accepted_singleton_unique/);
    assert.doesNotMatch(
      SQL_0025,
      /create unique index[\s\S]*temporal_scope->>'book_order'[\s\S]*fact_type in \('age'/,
    );
  });
});
