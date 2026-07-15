/**
 * Run Literary Agent review from CLI (same path as UI button).
 *
 *   node --env-file=.env.local --experimental-strip-types scripts/run-literary-agent-review.mjs [manuscriptId]
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootUrl = pathToFileURL(`${root}/`).href;

register(
  `data:text/javascript,${encodeURIComponent(`
import { statSync } from "node:fs";
import { pathToFileURL } from "node:url";
export function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: "data:text/javascript,export default {}", shortCircuit: true };
  }
  if (specifier === "next/cache") {
    return {
      url: "data:text/javascript,export function revalidatePath() {}",
      shortCircuit: true,
    };
  }
  if (specifier.startsWith("@/")) {
    const rel = specifier.slice(2);
    let base = new URL(rel, ${JSON.stringify(rootUrl)}).pathname;
    if (base.endsWith(".ts") || base.endsWith(".tsx")) {
      try { statSync(base); return { url: pathToFileURL(base).href, shortCircuit: true }; } catch {}
    }
    for (const c of [base + ".ts", base + ".tsx", base + "/index.ts"]) {
      try { statSync(c); return { url: pathToFileURL(c).href, shortCircuit: true }; } catch {}
    }
  }
  return nextResolve(specifier, context);
}
`)}`,
  import.meta.url,
);

const manuscriptId = process.argv[2] ?? "9f482ca2-a0f6-4709-8364-18a0ef950eb0";

console.log(`[literary-agent] Starting review for ${manuscriptId}…`);
const start = Date.now();

const { runFreshEditorialGeneration } = await import(
  "../lib/editorial-generation/run-fresh-editorial-generation.ts"
);
const result = await runFreshEditorialGeneration(manuscriptId);

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`[literary-agent] Finished in ${elapsed}s`);
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
