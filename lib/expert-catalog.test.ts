import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  LITERARY_AGENT_EXPERT_VERSION,
  literaryAgentRuntimeDefinition,
} from "@/experts/literary-agent/runtime-definition.ts";
import { LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH } from "@/lib/expert-review-engine/literary-agent-constitution-hash.ts";
import { hashExpertRuntimeDefinition } from "@/lib/expert-review-engine/types.ts";
import { hashExpertDefinition } from "@/lib/expert-registry/definition-hash.ts";
import { literaryAgentRegistryDefinitionV1 } from "@/lib/expert-registry/seed/literary-agent-registry.v1.ts";
import {
  EXPERT_CATALOG_ENTRIES,
  EXPERT_CATALOG_KEY_ORDER,
  getLiteraryAgentCatalogEntry,
  listExpertCatalogEntries,
  type ExpertCatalogKey,
} from "./expert-catalog.ts";
import {
  canToggleExpertSelection,
  createDefaultExpertSelection,
  hasLaunchableSelection,
  isLiteraryAgentSelected,
  listComingSoonExpertKeys,
  listSelectableExpertKeys,
  shouldStartLiteraryAgentWorkflow,
  toggleExpertSelection,
} from "./expert-team-selection.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RUNTIME_HASH =
  "f4006eaa497dd1d821f30fdac33dcb4869eff68d1af46b1f7401a972020ca50b";
const CONSTITUTION_HASH =
  "8f8b56a9de6c7d68f96fd7913645905ee2afb8ce7d0c066faba2c28106fe94f5";
const REGISTRY_SEED_HASH =
  "f6b79bc07d7ba9630fb532c67c31c4b80bac2886002696e25290d163e4b44671";

function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("expert catalog", () => {
  it("1. contains exactly six entries", () => {
    assert.equal(listExpertCatalogEntries().length, 6);
    assert.equal(EXPERT_CATALOG_ENTRIES.length, 6);
  });

  it("2. Literary Agent appears first", () => {
    assert.equal(EXPERT_CATALOG_KEY_ORDER[0], "literary_agent");
    assert.equal(EXPERT_CATALOG_ENTRIES[0]!.sortOrder, 1);
  });

  it("3. Literary Agent status is available", () => {
    const entry = getLiteraryAgentCatalogEntry();
    assert.equal(entry.availability, "available");
    assert.equal(entry.statusLabel, "Available");
  });

  it("4. Literary Agent certification is certified", () => {
    const entry = getLiteraryAgentCatalogEntry();
    assert.equal(entry.certificationStatus, "certified");
    assert.equal(entry.certificationLabel, "Certified");
  });

  it("5. Literary Agent selection is enabled", () => {
    assert.equal(getLiteraryAgentCatalogEntry().selectionEnabled, true);
    assert.ok(canToggleExpertSelection(getLiteraryAgentCatalogEntry()));
  });

  it("6. Developmental Editor appears", () => {
    assert.ok(EXPERT_CATALOG_ENTRIES.some((e) => e.key === "developmental_editor"));
  });

  it("7. Line Editor appears", () => {
    assert.ok(EXPERT_CATALOG_ENTRIES.some((e) => e.key === "line_editor"));
  });

  it("8. Psychologist appears", () => {
    assert.ok(EXPERT_CATALOG_ENTRIES.some((e) => e.key === "psychologist"));
  });

  it("9. Librarian appears", () => {
    assert.ok(EXPERT_CATALOG_ENTRIES.some((e) => e.displayName === "Librarian"));
  });

  it("10. Military Expert appears", () => {
    assert.ok(EXPERT_CATALOG_ENTRIES.some((e) => e.key === "military_expert"));
  });

  it("11. all five non-Literary-Agent experts show Coming Soon", () => {
    const comingSoon = listComingSoonExpertKeys();
    assert.equal(comingSoon.length, 5);
    assert.deepEqual(
      comingSoon.sort(),
      [
        "developmental_editor",
        "librarian",
        "line_editor",
        "military_expert",
        "psychologist",
      ].sort(),
    );
    for (const key of comingSoon) {
      const entry = EXPERT_CATALOG_ENTRIES.find((e) => e.key === key)!;
      assert.equal(entry.statusLabel, "Coming Soon");
    }
  });

  it("12. all five non-Literary-Agent selection controls are disabled", () => {
    for (const key of listComingSoonExpertKeys()) {
      const entry = EXPERT_CATALOG_ENTRIES.find((e) => e.key === key)!;
      assert.equal(entry.selectionEnabled, false);
      assert.equal(canToggleExpertSelection(entry), false);
    }
  });

  it("13. disabled experts cannot update selected state", () => {
    let selected = createDefaultExpertSelection();
    for (const key of listComingSoonExpertKeys()) {
      const before = new Set(selected);
      selected = toggleExpertSelection(selected, key);
      assert.deepEqual([...selected].sort(), [...before].sort());
    }
  });

  it("14. disabled experts cannot invoke execution", () => {
    const selected = new Set<ExpertCatalogKey>(listComingSoonExpertKeys());
    assert.equal(shouldStartLiteraryAgentWorkflow(selected), false);
    assert.equal(hasLaunchableSelection(selected), false);
  });

  it("15. Literary Agent can be selected", () => {
    let selected = new Set<ExpertCatalogKey>();
    selected = toggleExpertSelection(selected, "literary_agent");
    assert.ok(isLiteraryAgentSelected(selected));
  });

  it("16. Literary Agent can be deselected", () => {
    let selected = createDefaultExpertSelection();
    selected = toggleExpertSelection(selected, "literary_agent");
    assert.equal(isLiteraryAgentSelected(selected), false);
  });

  it("17. primary action disables when no available expert is selected", () => {
    const selected = new Set<ExpertCatalogKey>();
    assert.equal(hasLaunchableSelection(selected), false);
  });

  it("18. primary action enables when Literary Agent is selected", () => {
    assert.equal(hasLaunchableSelection(createDefaultExpertSelection()), true);
  });

  it("19. existing Literary Agent production action remains the launch path", () => {
    const source = read("app/manuscripts/[id]/RunAgentReviewButton.tsx");
    assert.match(source, /await startLiteraryAgentPublishingWorkflow\(manuscriptId\)/);
    assert.doesNotMatch(source, /runFreshEditorialGeneration/);
    assert.doesNotMatch(source, /runExpertReview/);
    assert.equal(
      (source.match(/await startLiteraryAgentPublishingWorkflow\(manuscriptId\)/g) ?? []).length,
      1,
    );
  });

  it("20. no new engine execution method is called from UI launch button", () => {
    const source = read("app/manuscripts/[id]/RunAgentReviewButton.tsx");
    assert.doesNotMatch(source, /runLiteraryAgentReplay/);
    assert.doesNotMatch(source, /runLiteraryAgentDeterministicParity/);
    assert.doesNotMatch(source, /executeExpertPlugin/);
  });

  it("21. runExpertReview is not imported by the UI", () => {
    const files = [
      "app/components/reviews/ExpertTeamSelector.tsx",
      "app/manuscripts/[id]/LiteraryAgentPublishingSection.tsx",
      "app/manuscripts/[id]/RunAgentReviewButton.tsx",
    ];
    for (const file of files) {
      const source = read(file);
      assert.doesNotMatch(source, /runExpertReview/);
      assert.doesNotMatch(source, /run-expert-review/);
    }
  });

  it("22. parity harness is not imported by the UI", () => {
    const files = [
      "app/components/reviews/ExpertTeamSelector.tsx",
      "app/manuscripts/[id]/LiteraryAgentPublishingSection.tsx",
      "app/manuscripts/[id]/RunAgentReviewButton.tsx",
    ];
    for (const file of files) {
      const source = read(file);
      assert.doesNotMatch(source, /literary-agent-parity/);
      assert.doesNotMatch(source, /runLiteraryAgentDeterministicParity/);
    }
  });

  it("23. replay harness is not imported by the UI", () => {
    const files = [
      "app/components/reviews/ExpertTeamSelector.tsx",
      "app/manuscripts/[id]/LiteraryAgentPublishingSection.tsx",
      "app/manuscripts/[id]/RunAgentReviewButton.tsx",
    ];
    for (const file of files) {
      const source = read(file);
      assert.doesNotMatch(source, /literary-agent-replay/);
      assert.doesNotMatch(source, /runLiteraryAgentReplay/);
    }
  });

  it("24. Coming Soon experts remain in catalog entries", () => {
    for (const key of listComingSoonExpertKeys()) {
      assert.ok(EXPERT_CATALOG_ENTRIES.some((entry) => entry.key === key));
    }
  });

  it("25. certification and status labels are explicit text fields", () => {
    for (const entry of EXPERT_CATALOG_ENTRIES) {
      assert.ok(entry.statusLabel.length > 0);
      assert.ok(entry.certificationLabel.length > 0);
      assert.notEqual(entry.statusLabel, entry.certificationLabel);
    }
    assert.equal(getLiteraryAgentCatalogEntry().statusLabel, "Available");
    assert.equal(getLiteraryAgentCatalogEntry().certificationLabel, "Certified");
  });

  it("26. selector layout uses responsive grid without horizontal overflow classes", () => {
    const source = read("app/components/reviews/ExpertTeamSelector.tsx");
    assert.match(source, /grid gap-4 md:grid-cols-2 xl:grid-cols-3/);
    assert.doesNotMatch(source, /overflow-x-auto/);
    assert.doesNotMatch(source, /min-w-\[/);
  });

  it("27. Literary Agent launch gating preserves workflow-only path", () => {
    const section = read("app/manuscripts/[id]/LiteraryAgentPublishingSection.tsx");
    assert.match(section, /hasLaunchableSelection/);
    assert.match(section, /literaryAgentSelected/);
    assert.doesNotMatch(section, /runFreshEditorialGeneration/);
  });

  it("28. executionAllowed remains false repository-wide", () => {
    const source = read("lib/expert-review-engine/run-expert-review.ts");
    assert.match(source, /executionAllowed:\s*false/);
    assert.doesNotMatch(source, /executionAllowed:\s*true/);
  });

  it("29. canonical hashes remain unchanged", () => {
    assert.equal(hashExpertRuntimeDefinition(literaryAgentRuntimeDefinition()), RUNTIME_HASH);
    assert.equal(LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH, CONSTITUTION_HASH);
    assert.equal(hashExpertDefinition(literaryAgentRegistryDefinitionV1()), REGISTRY_SEED_HASH);
    assert.equal(LITERARY_AGENT_EXPERT_VERSION, literaryAgentRuntimeDefinition().expert_version);
  });

  it("30. no migration or replay feature flag added by catalog files", () => {
    const catalog = read("lib/expert-catalog.ts");
    const selection = read("lib/expert-team-selection.ts");
    assert.doesNotMatch(catalog, /0024/);
    assert.doesNotMatch(selection, /EXPERT_LITERARY_AGENT_REPLAY_ENABLED/);
    assert.doesNotMatch(catalog, /runExpertReview/);
    assert.equal(listSelectableExpertKeys().length, 1);
    assert.deepEqual(listSelectableExpertKeys(), ["literary_agent"]);
  });
});

describe("expert catalog truthfulness", () => {
  it("does not mark planned experts as available or certified", () => {
    for (const entry of EXPERT_CATALOG_ENTRIES) {
      if (entry.key === "literary_agent") continue;
      assert.notEqual(entry.availability, "available");
      assert.notEqual(entry.certificationStatus, "certified");
      assert.match(entry.statusLabel, /Coming Soon/i);
      assert.match(entry.certificationLabel, /Planned/i);
    }
  });

  it("does not expose operational language for coming soon experts", () => {
    for (const entry of EXPERT_CATALOG_ENTRIES) {
      if (entry.key === "literary_agent") continue;
      assert.doesNotMatch(entry.statusLabel, /^(Ready|Active|Built)$/i);
      assert.doesNotMatch(entry.shortDescription, /\bexecute\b/i);
    }
  });
});
