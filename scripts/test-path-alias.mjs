/**
 * Register @/ path alias and server-only stubs for node --test runs.
 * Mirrors scripts/run-literary-agent-review.mjs resolver.
 */
import { register } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
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
