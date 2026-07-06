// Apply all SQL files in supabase/migrations against SUPABASE_DB_URL.
// Migrations are written idempotently (create ... if not exists, drop ... if
// exists), so re-running is safe.
//   node --env-file=.env.local scripts/migrate.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is not set (add it to .env.local).");
  process.exit(1);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

let failed = 0;
for (const f of files) {
  const sql = readFileSync(join(dir, f), "utf8");
  try {
    await client.query(sql);
    console.log("✓", f);
  } catch (e) {
    if (/already exists/i.test(e.message)) {
      console.log("•", f, "(already applied)");
    } else {
      console.log("✗", f, "—", e.message);
      failed++;
    }
  }
}

await client.end();
console.log(failed === 0 ? "\nAll migrations applied." : `\n${failed} migration(s) had errors.`);
process.exit(failed === 0 ? 0 : 1);
