/**
 * Audit and optionally backfill manuscript word_count from canonical extracted_text.
 *
 *   node --env-file=.env.local --experimental-strip-types scripts/validate-word-count.ts
 *   node --env-file=.env.local --experimental-strip-types scripts/validate-word-count.ts --apply
 */
import pg from "pg";
import { countManuscriptWords } from "../lib/word-count.ts";

const APPLY = process.argv.includes("--apply");

function oldSplitCount(text: string | null): number {
  if (!text) return 0;
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Heuristic: does extracted_text appear concatenated with itself? */
function detectDuplicateText(text: string | null): boolean {
  if (!text || text.length < 200) return false;
  const half = Math.floor(text.length / 2);
  const a = text.slice(0, half).trim();
  const b = text.slice(half).trim();
  if (a.length < 100 || b.length < 100) return false;
  if (a === b) return true;
  const sample = a.slice(0, Math.min(500, a.length));
  if (sample.length < 50) return false;
  const firstIdx = b.indexOf(sample);
  return firstIdx >= 0 && firstIdx < 50;
}

function abortUpdate(client: pg.Client, manuscriptId: string, affected: number): never {
  console.error(
    `\nABORT: UPDATE for manuscript ${manuscriptId} affected ${affected} row(s); expected exactly 1.`,
  );
  void client.end();
  process.exit(1);
}

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error("SUPABASE_DB_URL is not set.");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const { rows } = await client.query<{
    id: string;
    title: string;
    word_count: number | null;
    extracted_text: string | null;
  }>(
    `select id, title, word_count, extracted_text from public.manuscripts order by created_at`,
  );

  console.log(`\nManuscript word count audit (${rows.length} rows)\n`);
  console.log(
    [
      "id",
      "title",
      "char_len",
      "stored",
      "old_split",
      "canonical",
      "delta",
      "duplicate?",
    ].join("\t"),
  );

  let updates = 0;
  for (const row of rows) {
    const text = row.extracted_text ?? "";
    const charLen = text.length;
    const stored = row.word_count ?? 0;
    const oldSplit = oldSplitCount(text);
    const canonical = countManuscriptWords(text);
    const delta = canonical - stored;
    const dup = detectDuplicateText(text);

    console.log(
      [
        row.id,
        (row.title ?? "").slice(0, 40),
        charLen,
        stored,
        oldSplit,
        canonical,
        delta,
        dup ? "YES" : "no",
      ].join("\t"),
    );

    if (APPLY && canonical !== stored) {
      const result = await client.query<{ id: string }>(
        `update public.manuscripts
         set word_count = $1, updated_at = now()
         where id = $2
         returning id`,
        [canonical, row.id],
      );
      const affected = result.rowCount ?? result.rows.length;
      if (affected !== 1 || result.rows.length !== 1 || result.rows[0]?.id !== row.id) {
        abortUpdate(client, row.id, affected);
      }
      console.log(
        `APPLIED\t${row.id}\tstored=${stored}\tcanonical=${canonical}\taffected_rows=${affected}`,
      );
      updates++;
    }
  }

  await client.end();

  if (APPLY) {
    console.log(`\nBackfill applied: ${updates} row(s) updated.`);
  } else {
    console.log("\nDry run only. Pass --apply to persist canonical word_count values.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
