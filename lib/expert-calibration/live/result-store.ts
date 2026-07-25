import { mkdirSync, renameSync, writeFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import type { ResultStoreWriteInput } from "./contracts.ts";
import { LiveCalibrationError } from "./errors.ts";
import { LIVE_CALIBRATION_APPROVED_ROOT } from "./constants.ts";

export function resolveApprovedOutputPath(outputDir: string, cwd: string = process.cwd()): string {
  const resolved = resolve(cwd, outputDir);
  const approvedRoot = resolve(cwd, LIVE_CALIBRATION_APPROVED_ROOT);
  const sep = process.platform === "win32" ? "\\" : "/";

  if (resolved === approvedRoot || resolved.startsWith(`${approvedRoot}${sep}`)) {
    return resolved;
  }

  throw new LiveCalibrationError(
    "result_store_rejected",
    `Output directory must be under ${LIVE_CALIBRATION_APPROVED_ROOT}/`,
  );
}

export function rejectPathTraversal(outputDir: string): void {
  if (outputDir.includes("..")) {
    throw new LiveCalibrationError(
      "result_store_rejected",
      "Path traversal rejected in output directory",
    );
  }
}

/** Ensures the output directory exists; outputDir is the run directory itself. */
export function ensureRunDirectory(outputDir: string, _runId: string, overwrite: boolean): string {
  rejectPathTraversal(outputDir);
  const runDir = resolveApprovedOutputPath(outputDir);

  if (existsSync(runDir)) {
    const manifestPath = join(runDir, "run-manifest.json");
    if (existsSync(manifestPath) && !overwrite) {
      throw new LiveCalibrationError(
        "result_store_rejected",
        `Run directory already contains manifest: ${relative(process.cwd(), runDir)}`,
      );
    }
  } else {
    mkdirSync(runDir, { recursive: true });
  }

  return runDir;
}

export function writeAtomicArtifact(input: ResultStoreWriteInput): string {
  rejectPathTraversal(input.outputDir);
  const runDir = ensureRunDirectory(input.outputDir, input.runId, input.overwrite);
  const targetPath = join(runDir, input.filename);
  const tmpPath = `${targetPath}.tmp`;

  if (existsSync(targetPath) && !input.overwrite) {
    throw new LiveCalibrationError(
      "result_store_rejected",
      `Artifact already exists: ${input.filename}`,
    );
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(tmpPath, input.content, "utf8");
  renameSync(tmpPath, targetPath);
  return targetPath;
}

export function writeRunManifest(
  outputDir: string,
  runId: string,
  manifest: unknown,
  overwrite: boolean,
): string {
  return writeAtomicArtifact({
    outputDir,
    runId,
    filename: "run-manifest.json",
    content: JSON.stringify(manifest, null, 2),
    overwrite,
  });
}

export function validateResultStorePath(path: string): boolean {
  try {
    resolveApprovedOutputPath(path);
    return true;
  } catch {
    return false;
  }
}

export function isUnderApprovedRoot(path: string, cwd: string = process.cwd()): boolean {
  try {
    resolveApprovedOutputPath(path, cwd);
    return true;
  } catch {
    return false;
  }
}

export function getArtifactSize(path: string): number {
  return statSync(path).size;
}
