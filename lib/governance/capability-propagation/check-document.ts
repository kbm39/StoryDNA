/**
 * Document conformance checks for Capability Propagation Review blocks.
 */

import {
  validateCapabilityPropagationReviewBlock,
  validateConstitutionComplianceBlock,
  validateNoNewCapabilityDeclaration,
} from "./validate.ts";
import type {
  CapabilityPropagationReviewBlock,
  ConstitutionComplianceBlock,
  NoNewCapabilityDeclaration,
} from "./types.ts";

export type DocumentGovernanceMetadata = {
  constitution_compliance?: ConstitutionComplianceBlock;
  capability_propagation_review?: CapabilityPropagationReviewBlock;
  no_new_capability?: NoNewCapabilityDeclaration;
};

export type DocumentCheckResult =
  | { ok: true; mode: "no_new_capability" | "capability_review" }
  | { ok: false; errors: string[] };

const YAML_FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

function parseSimpleYamlBlock(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentKey: string | null = null;
  let listItems: string[] = [];

  const flushList = () => {
    if (currentKey) {
      result[currentKey] = listItems;
      listItems = [];
      currentKey = null;
    }
  };

  for (const line of yaml.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const listMatch = trimmed.match(/^- (.+)$/);
    if (listMatch && currentKey) {
      listItems.push(listMatch[1].trim());
      continue;
    }

    flushList();
    const kv = trimmed.match(/^([a-z0-9_]+):\s*(.*)$/i);
    if (!kv) continue;
    const [, key, value] = kv;
    if (value === "") {
      currentKey = key;
      listItems = [];
    } else if (value === "true") {
      result[key] = true;
    } else if (value === "false") {
      result[key] = false;
    } else {
      result[key] = value.replace(/^["']|["']$/g, "");
    }
  }
  flushList();
  return result;
}

function extractJsonBlock(content: string, marker: string): unknown | undefined {
  const re = new RegExp(
    `${marker}\\s*\`\`\`json\\s*([\\s\\S]*?)\\s*\`\`\``,
    "i",
  );
  const match = content.match(re);
  if (!match) return undefined;
  try {
    return JSON.parse(match[1]) as unknown;
  } catch {
    return undefined;
  }
}

export function parseDocumentGovernanceMetadata(
  content: string,
): DocumentGovernanceMetadata {
  const metadata: DocumentGovernanceMetadata = {};

  const frontMatter = content.match(YAML_FRONT_MATTER);
  if (frontMatter) {
    const yaml = parseSimpleYamlBlock(frontMatter[1]);
    if (yaml.no_new_capability === true) {
      metadata.no_new_capability = {
        no_new_capability: true,
        rationale: String(yaml.rationale ?? ""),
      };
    }
  }

  const compliance =
    extractJsonBlock(content, "Constitution Compliance") ??
    extractJsonBlock(content, "## Constitution Compliance");
  if (compliance) {
    metadata.constitution_compliance = compliance as ConstitutionComplianceBlock;
  }

  const propagation =
    extractJsonBlock(content, "Capability Propagation Review") ??
    extractJsonBlock(content, "## Capability Propagation Review");
  if (propagation) {
    metadata.capability_propagation_review =
      propagation as CapabilityPropagationReviewBlock;
  }

  const declaresNewCapability =
    /new[_\s-]?capability[_\s-]?introduced\s*:/i.test(content) ||
    /## Capability Propagation Review/i.test(content) ||
    /"new_capability_introduced"\s*:/.test(content);

  if (
    declaresNewCapability &&
    !metadata.no_new_capability &&
    content.match(/new capability introduced:\s*\S/i) &&
    !content.match(/new capability introduced:\s*(none|no|n\/a)/i)
  ) {
    metadata.capability_propagation_review ??=
      metadata.capability_propagation_review;
  }

  return metadata;
}

export function documentDeclaresNewCapability(content: string): boolean {
  if (/no_new_capability:\s*true/i.test(content)) return false;

  const jsonBlock = extractJsonBlock(content, "Capability Propagation Review");
  if (jsonBlock && typeof jsonBlock === "object" && jsonBlock !== null) {
    const introduced = (jsonBlock as Record<string, unknown>).new_capability_introduced;
    if (typeof introduced === "string") {
      const normalized = introduced.trim().toLowerCase();
      if (!introduced.trim() || ["none", "no", "n/a"].includes(normalized)) {
        return false;
      }
      return true;
    }
  }

  const markdownMatch = content.match(
    /- New capability introduced:\s*(.+)/i,
  );
  if (markdownMatch) {
    const normalized = markdownMatch[1].trim().toLowerCase();
    if (["none", "no", "n/a", ""].includes(normalized)) return false;
    return true;
  }

  if (/capability_id:\s*\S+/i.test(content) && /proposed_classification:/i.test(content)) {
    return true;
  }

  return false;
}

export function checkGovernanceDocument(content: string): DocumentCheckResult {
  const metadata = parseDocumentGovernanceMetadata(content);
  const errors: string[] = [];

  const complianceResult = metadata.constitution_compliance
    ? validateConstitutionComplianceBlock(metadata.constitution_compliance)
    : { ok: false as const, errors: ["Constitution Compliance block is required"] };
  if (!complianceResult.ok) {
    errors.push(...complianceResult.errors.map((e) => `Constitution Compliance: ${e}`));
  }

  if (metadata.no_new_capability) {
    const noNew = validateNoNewCapabilityDeclaration(metadata.no_new_capability);
    if (!noNew.ok) {
      errors.push(...noNew.errors.map((e) => `no_new_capability: ${e}`));
    } else if (documentDeclaresNewCapability(content)) {
      errors.push(
        "Document declares no_new_capability but also declares a new capability",
      );
    } else if (errors.length === 0) {
      return { ok: true, mode: "no_new_capability" };
    }
    return { ok: false, errors };
  }

  if (!documentDeclaresNewCapability(content)) {
    if (errors.length === 0) {
      return { ok: true, mode: "no_new_capability" };
    }
    return { ok: false, errors };
  }

  if (!metadata.capability_propagation_review) {
    errors.push(
      "Capability Propagation Review block or linked review artifact is required when declaring a new capability",
    );
    return { ok: false, errors };
  }

  const reviewResult = validateCapabilityPropagationReviewBlock(
    metadata.capability_propagation_review,
  );
  if (!reviewResult.ok) {
    errors.push(
      ...reviewResult.errors.map((e) => `Capability Propagation Review: ${e}`),
    );
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, mode: "capability_review" };
}
