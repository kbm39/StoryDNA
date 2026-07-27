/** Simple word-level textual diff — preview only, no mutation. */

export interface TextDiffLine {
  readonly kind: "unchanged" | "removed" | "added";
  readonly text: string;
}

export function buildTextualDiffLines(original: string, final: string): readonly TextDiffLine[] {
  if (original === final) {
    return Object.freeze([Object.freeze({ kind: "unchanged" as const, text: original || "(empty)" })]);
  }

  const origWords = original.split(/(\s+)/).filter((w) => w.length > 0);
  const finalWords = final.split(/(\s+)/).filter((w) => w.length > 0);

  let prefix = 0;
  while (
    prefix < origWords.length &&
    prefix < finalWords.length &&
    origWords[prefix] === finalWords[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < origWords.length - prefix &&
    suffix < finalWords.length - prefix &&
    origWords[origWords.length - 1 - suffix] === finalWords[finalWords.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const lines: TextDiffLine[] = [];
  const unchangedPrefix = origWords.slice(0, prefix).join("");
  if (unchangedPrefix) lines.push({ kind: "unchanged", text: unchangedPrefix });

  const removed = origWords.slice(prefix, origWords.length - suffix).join("");
  const added = finalWords.slice(prefix, finalWords.length - suffix).join("");
  if (removed) lines.push({ kind: "removed", text: removed });
  if (added) lines.push({ kind: "added", text: added });

  const unchangedSuffix = origWords.slice(origWords.length - suffix).join("");
  if (unchangedSuffix) lines.push({ kind: "unchanged", text: unchangedSuffix });

  return Object.freeze(lines);
}

export function formatTextualDiffForDisplay(lines: readonly TextDiffLine[]): string {
  return lines
    .map((line) => {
      if (line.kind === "unchanged") return `  ${line.text}`;
      if (line.kind === "removed") return `- ${line.text}`;
      return `+ ${line.text}`;
    })
    .join("\n");
}

export const DIFF_PREVIEW_NOTICE =
  "Preview only — not yet applied to manuscript." as const;
