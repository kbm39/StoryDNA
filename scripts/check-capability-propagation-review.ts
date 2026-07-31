#!/usr/bin/env node
/**
 * Validate governance documents for Capability Propagation Review conformance.
 *
 * Usage:
 *   npm run governance:capability-check
 *   npm run governance:capability-check -- path/to/design.md
 *   npm run governance:capability-check -- --changed-only
 *
 * Never inspects manuscript content. Never calls providers.
 */
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkGovernanceDocument } from "@/lib/governance/capability-propagation/check-document.ts";
import { loadCapabilityRegistry } from "@/lib/governance/capability-propagation/registry.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_PATHS = [
  "docs/governance",
];

const GOVERNANCE_DOC_GLOBS = [
  /^docs\/governance\//,
];

function isGovernanceDoc(relativePath: string): boolean {
  if (!relativePath.endsWith(".md")) return false;
  if (relativePath === "docs/governance/STORYDNA_EDITORIAL_CONSTITUTION_V1.0.md") return false;
  return GOVERNANCE_DOC_GLOBS.some((re) => re.test(relativePath));
}

function listChangedMarkdownFiles(): string[] {
  try {
    const out = execSync("git diff --name-only HEAD && git diff --name-only --cached HEAD", {
      cwd: ROOT,
      encoding: "utf8",
    });
    const untracked = execSync("git ls-files --others --exclude-standard", {
      cwd: ROOT,
      encoding: "utf8",
    });
    const files = new Set(
      `${out}\n${untracked}`
        .split(/\r?\n/)
        .map((f) => f.trim())
        .filter(Boolean),
    );
    return [...files].filter(isGovernanceDoc).map((f) => path.join(ROOT, f));
  } catch {
    return [];
  }
}

function walkMarkdownFiles(dir: string, root: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const abs = path.join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) {
      walkMarkdownFiles(abs, root, out);
      continue;
    }
    if (!entry.endsWith(".md")) continue;
    const rel = path.relative(root, abs);
    if (isGovernanceDoc(rel)) out.push(abs);
  }
}

function collectPaths(argv: string[]): string[] {
  if (argv.includes("--changed-only")) {
    return listChangedMarkdownFiles();
  }

  const explicit = argv.filter((a) => !a.startsWith("-"));
  if (explicit.length > 0) {
    return explicit.map((p) => path.resolve(p));
  }

  const collected: string[] = [];
  for (const rel of DEFAULT_PATHS) {
    const abs = path.join(ROOT, rel);
    try {
      statSync(abs);
    } catch {
      continue;
    }
    walkMarkdownFiles(abs, ROOT, collected);
  }
  return collected;
}

function main() {
  // Always validate registry integrity when check runs.
  loadCapabilityRegistry();

  const targets = collectPaths(process.argv.slice(2));
  if (targets.length === 0) {
    console.log("governance:capability-check — no governance markdown files to inspect.");
    process.exit(0);
  }

  let failed = 0;
  for (const file of targets) {
    let content: string;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      console.error(`Cannot read ${file}`);
      failed += 1;
      continue;
    }

    const result = checkGovernanceDocument(content);
    const rel = path.relative(ROOT, file);
    if (!result.ok) {
      failed += 1;
      console.error(`FAIL ${rel}`);
      for (const err of result.errors) {
        console.error(`  - ${err}`);
      }
    } else {
      console.log(`OK   ${rel} (${result.mode})`);
    }
  }

  if (failed > 0) {
    console.error(
      `\nCapability Propagation governance check failed for ${failed} document(s).`,
    );
    console.error(
      "Add a Capability Propagation Review block, or declare no_new_capability: true with rationale.",
    );
    process.exit(1);
  }

  console.log("\nCapability Propagation governance check passed.");
}

main();
