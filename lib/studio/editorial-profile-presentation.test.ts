import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, beforeEach, describe, it } from "node:test";
import { STUDIO_AUTHOR_INTENT_FLAG_NAME } from "@/lib/author-intent/feature-flag.ts";
import { STUDIO_EIC_FLAG_NAME } from "@/lib/eic/feature-flag.ts";
import {
  AUTHOR_FACING_SECTION_ORDER,
  AUTHOR_FACING_SECTION_TITLES,
} from "@/lib/editorial-profile/author-facing-contract.ts";
import { STUDIO_EDITORIAL_PROFILE_FLAG_NAME } from "@/lib/editorial-profile/feature-flag.ts";
import {
  EDITORIAL_PROFILE_HEADER_EXPLANATION,
  EDITORIAL_PROFILE_STATE_MESSAGES,
  loadEditorialProfilePresentation,
  toStudioEditorialProfilePresentation,
} from "./editorial-profile-presentation.ts";
import {
  STUDIO_EDITORIAL_PROFILE_DEV_FIXTURE_ENV,
  parseStudioEditorialProfileDevFixtureMode,
  resolveStudioEditorialProfileFixture,
} from "./editorial-profile-fixtures.ts";
import { createAuthorFacingEditorialProfileReadModel } from "@/lib/editorial-profile/author-facing-read-model.ts";
import { buildFixtureActiveEditorialProfile } from "@/lib/editorial-profile/fixtures/active-profile-fixture.ts";
import {
  FIXTURE_MS_ID,
  FIXTURE_VER_ID,
} from "@/lib/editorial-profile/fixtures/independent-read-fixtures.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const EP_DIR = join(ROOT, "app/studio/books/[bookId]/editorial-profile");

function enableProfileFlags() {
  process.env[STUDIO_EDITORIAL_PROFILE_FLAG_NAME] = "1";
  process.env[STUDIO_EIC_FLAG_NAME] = "1";
  process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME] = "1";
  process.env.NODE_ENV = "development";
}

function setDevFixture(mode: string | null) {
  if (mode === null) delete process.env[STUDIO_EDITORIAL_PROFILE_DEV_FIXTURE_ENV];
  else process.env[STUDIO_EDITORIAL_PROFILE_DEV_FIXTURE_ENV] = mode;
}

function readComponent(name: string): string {
  return readFileSync(join(EP_DIR, name), "utf8");
}

describe("EP-6 Studio Editorial Profile presentation", () => {
  const savedProfile = process.env[STUDIO_EDITORIAL_PROFILE_FLAG_NAME];
  const savedEic = process.env[STUDIO_EIC_FLAG_NAME];
  const savedIntent = process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME];
  const savedNodeEnv = process.env.NODE_ENV;
  const savedFixture = process.env[STUDIO_EDITORIAL_PROFILE_DEV_FIXTURE_ENV];

  beforeEach(() => {
    enableProfileFlags();
    setDevFixture(null);
  });

  after(() => {
    if (savedProfile === undefined) delete process.env[STUDIO_EDITORIAL_PROFILE_FLAG_NAME];
    else process.env[STUDIO_EDITORIAL_PROFILE_FLAG_NAME] = savedProfile;
    if (savedEic === undefined) delete process.env[STUDIO_EIC_FLAG_NAME];
    else process.env[STUDIO_EIC_FLAG_NAME] = savedEic;
    if (savedIntent === undefined) delete process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME];
    else process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME] = savedIntent;
    if (savedFixture === undefined) delete process.env[STUDIO_EDITORIAL_PROFILE_DEV_FIXTURE_ENV];
    else process.env[STUDIO_EDITORIAL_PROFILE_DEV_FIXTURE_ENV] = savedFixture;
    process.env.NODE_ENV = savedNodeEnv;
  });

  it("1. feature disabled state", async () => {
    delete process.env[STUDIO_EDITORIAL_PROFILE_FLAG_NAME];
    const result = await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      manuscriptTitle: "Book",
      versionLabel: "v1",
    });
    assert.equal(result.state, "feature_disabled");
  });

  it("2. no active profile when fixture unset", async () => {
    const result = await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      manuscriptTitle: "Book",
      versionLabel: "v1",
    });
    assert.equal(result.state, "no_active_profile");
  });

  it("3. no active profile without version id", async () => {
    const result = await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: null,
      manuscriptTitle: "Book",
      versionLabel: null,
    });
    assert.equal(result.state, "no_active_profile");
  });

  it("4. active profile available with dev fixture", async () => {
    setDevFixture("active");
    const result = await loadEditorialProfilePresentation({
      manuscriptId: FIXTURE_MS_ID,
      manuscriptVersionId: FIXTURE_VER_ID,
      manuscriptTitle: "Hold Fast",
      versionLabel: "v3",
    });
    assert.equal(result.state, "active_profile_available");
    assert.ok(result.presentation);
  });

  it("5. profile being prepared state", async () => {
    setDevFixture("generating");
    const result = await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      manuscriptTitle: "Book",
      versionLabel: "v1",
    });
    assert.equal(result.state, "profile_being_prepared");
  });

  it("6. incomplete evidence state", async () => {
    setDevFixture("incomplete_evidence");
    const result = await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      manuscriptTitle: "Book",
      versionLabel: "v1",
    });
    assert.equal(result.state, "incomplete_evidence");
  });

  it("7. awaiting EIC confirmation state", async () => {
    setDevFixture("awaiting_eic_confirmation");
    const result = await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      manuscriptTitle: "Book",
      versionLabel: "v1",
    });
    assert.equal(result.state, "awaiting_eic_confirmation");
  });

  it("8. blocked state", async () => {
    setDevFixture("blocked");
    const result = await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      manuscriptTitle: "Book",
      versionLabel: "v1",
    });
    assert.equal(result.state, "blocked");
  });

  it("9. generation failed state", async () => {
    setDevFixture("failed");
    const result = await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      manuscriptTitle: "Book",
      versionLabel: "v1",
    });
    assert.equal(result.state, "generation_failed");
  });

  it("10. read model validation failed state", async () => {
    setDevFixture("validation_failed");
    const result = await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      manuscriptTitle: "Book",
      versionLabel: "v1",
    });
    assert.equal(result.state, "read_model_validation_failed");
  });

  it("11. presentation section order matches contract", async () => {
    setDevFixture("active");
    const result = await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      manuscriptTitle: "Book",
      versionLabel: "v1",
    });
    assert.equal(result.state, "active_profile_available");
    const keys = result.presentation!.sections.map((s) => s.section_key);
    assert.deepEqual(keys, [...AUTHOR_FACING_SECTION_ORDER]);
  });

  it("12. first section is Editorial Understanding not grade or risks", async () => {
    setDevFixture("active");
    const result = await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      manuscriptTitle: "Book",
      versionLabel: "v1",
    });
    assert.equal(result.presentation!.sections[0]?.section_key, "editorial_understanding");
    assert.notEqual(result.presentation!.sections[0]?.section_key, "editorial_risks");
  });

  it("13. studio presentation excludes profile_id from payload fields", async () => {
    setDevFixture("active");
    const result = await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      manuscriptTitle: "Book",
      versionLabel: "v1",
    });
    const serialized = JSON.stringify(result.presentation);
    assert.doesNotMatch(serialized, /profile-fixture-1|profile_id/);
  });

  it("14. header explanation copy", async () => {
    setDevFixture("active");
    const result = await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      manuscriptTitle: "Book",
      versionLabel: "v1",
    });
    assert.equal(result.presentation!.headerExplanation, EDITORIAL_PROFILE_HEADER_EXPLANATION);
  });

  it("15. specialist recommendations not activated", async () => {
    setDevFixture("active");
    const result = await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      manuscriptTitle: "Book",
      versionLabel: "v1",
    });
    for (const rec of result.presentation!.recommendedSpecialistSupport) {
      assert.equal(rec.specialist_not_activated, true);
      assert.equal(rec.manuscript_sharing_not_authorized, true);
    }
  });

  it("16. roadmap not generated", async () => {
    setDevFixture("active");
    const result = await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      manuscriptTitle: "Book",
      versionLabel: "v1",
    });
    assert.equal(result.presentation!.roadmapPreparation.roadmap_generated, false);
    assert.equal(result.presentation!.roadmapPreparation.no_final_next_best_action, true);
  });

  it("17. confidence labels from read model", async () => {
    setDevFixture("active");
    const result = await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      manuscriptTitle: "Book",
      versionLabel: "v1",
    });
    assert.match(result.presentation!.confidenceAndUncertainty.overall_confidence_label, /confidence|evidence/i);
  });

  it("18. evidence references preserved in strengths", async () => {
    setDevFixture("active");
    const result = await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      manuscriptTitle: "Book",
      versionLabel: "v1",
    });
    const withEvidence = result.presentation!.whatIsWorking.find((s) => s.evidence.length > 0);
    assert.ok(withEvidence);
    assert.ok(withEvidence!.evidence[0]?.locator_label);
  });

  it("19. author control statement present", async () => {
    setDevFixture("active");
    const result = await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      manuscriptTitle: "Book",
      versionLabel: "v1",
    });
    assert.ok(result.presentation!.authorControlStatement.length > 0);
    assert.ok(result.presentation!.whatHappensNext.author_retains_final_authority);
  });

  it("20. state messages use author-facing language", () => {
    assert.doesNotMatch(EDITORIAL_PROFILE_STATE_MESSAGES.generation_failed, /stack|enum|status:/i);
    assert.doesNotMatch(EDITORIAL_PROFILE_STATE_MESSAGES.blocked, /author_disputed|superseded/i);
  });

  it("21. dev fixture mode parser", () => {
    process.env[STUDIO_EDITORIAL_PROFILE_DEV_FIXTURE_ENV] = "active";
    assert.equal(parseStudioEditorialProfileDevFixtureMode(), "active");
    process.env[STUDIO_EDITORIAL_PROFILE_DEV_FIXTURE_ENV] = "none";
    assert.equal(parseStudioEditorialProfileDevFixtureMode(), "none");
  });

  it("22. fixture remaps manuscript scope", () => {
    setDevFixture("active");
    const profile = resolveStudioEditorialProfileFixture({
      manuscriptId: "custom-ms",
      manuscriptVersionId: "custom-ver",
    });
    assert.equal(profile?.manuscript_id, "custom-ms");
    assert.equal(profile?.manuscript_version_id, "custom-ver");
  });

  it("23. toStudioPresentationPayload strips provenance ids", () => {
    const readModel = createAuthorFacingEditorialProfileReadModel({
      profile: buildFixtureActiveEditorialProfile(),
      expectedManuscriptId: FIXTURE_MS_ID,
      expectedManuscriptVersionId: FIXTURE_VER_ID,
    });
    assert.equal(readModel.ok, true);
    if (!readModel.ok) return;
    const presentation = toStudioEditorialProfilePresentation({
      readModel: readModel.readModel,
      manuscriptTitle: "Book",
      versionLabel: "v1",
    });
    assert.equal("provenance" in presentation, false);
    assert.equal("profile_id" in presentation, false);
  });

  it("24. server action requires studio access", () => {
    const src = readFileSync(join(ROOT, "app/studio/actions/editorial-profile.ts"), "utf8");
    assert.match(src, /requireStudioAccess/);
    assert.match(src, /editorial-profile/);
  });

  it("25. page route uses loader not authoritative profile", () => {
    const src = readFileSync(join(EP_DIR, "page.tsx"), "utf8");
    assert.match(src, /getEditorialProfilePageData/);
    assert.doesNotMatch(src, /EditorialProfileV1/);
  });

  it("26. EditorialProfileView enforces section order guard", () => {
    const src = readComponent("EditorialProfileView.tsx");
    assert.match(src, /AUTHOR_FACING_SECTION_ORDER/);
    assert.match(src, /EditorialUnderstandingSection/);
  });

  it("27. first rendered section component is EditorialUnderstandingSection", () => {
    const src = readComponent("EditorialProfileView.tsx");
    const understandingIndex = src.indexOf("<EditorialUnderstandingSection");
    const risksIndex = src.indexOf("<EditorialRisksSection");
    assert.ok(understandingIndex >= 0 && risksIndex >= 0);
    assert.ok(understandingIndex < risksIndex);
  });

  it("28. no grade in presentation components", () => {
    const files = [
      "EditorialProfileView.tsx",
      "EditorialProfileHeader.tsx",
      "StrengthsSection.tsx",
      "EditorialRisksSection.tsx",
    ];
    for (const file of files) {
      const src = readComponent(file);
      assert.doesNotMatch(src, /\bgrade\b/i);
    }
  });

  it("29. specialist section has no action buttons", () => {
    const src = readComponent("SpecialistSupportSection.tsx");
    assert.doesNotMatch(src, /<button|<form|\bRun\b|\bActivate\b|\bRecruit\b|\bApprove\b/i);
    assert.match(src, /Specialist not activated/);
    assert.match(src, /Manuscript not shared/);
  });

  it("30. roadmap section states not generated", () => {
    const src = readComponent("RoadmapPreparationSection.tsx");
    assert.match(src, /not generated|No next best action/i);
    assert.doesNotMatch(src, /<button/i);
  });

  it("31. state view uses role=status for screen readers", () => {
    const src = readComponent("EditorialProfileStateView.tsx");
    assert.match(src, /role="status"/);
    assert.match(src, /aria-live="polite"/);
  });

  it("32. sections use semantic heading hierarchy", () => {
    const src = readComponent("presentation-utils.tsx");
    assert.match(src, /<section/);
    assert.match(src, /<h2/);
  });

  it("33. header uses h1", () => {
    const src = readComponent("EditorialProfileHeader.tsx");
    assert.match(src, /<h1/);
    assert.match(src, /Editorial Profile/);
  });

  it("34. nav link added in StudioShell", () => {
    const src = readFileSync(join(ROOT, "app/studio/components/StudioShell.tsx"), "utf8");
    assert.match(src, /editorial-profile/);
    assert.match(src, /Editorial Profile/);
  });

  it("35. client component is read-only", () => {
    const src = readComponent("EditorialProfileClient.tsx");
    assert.doesNotMatch(src, /useTransition|onSubmit|onClick|fetch\(/);
  });

  it("36. loader does not import provider or model clients", () => {
    const src = readFileSync(join(ROOT, "lib/studio/editorial-profile-presentation.ts"), "utf8");
    assert.doesNotMatch(src, /anthropic|openai|@trigger|generateText/i);
  });

  it("37. no migration references in presentation module", () => {
    const src = readFileSync(join(ROOT, "lib/studio/editorial-profile-presentation.ts"), "utf8");
    assert.doesNotMatch(src, /migration|supabase\.from/i);
  });

  it("38. protected assets visually distinct", () => {
    const src = readComponent("ProtectedAssetsSection.tsx");
    assert.match(src, /emerald/);
  });

  it("39. editorial understanding renders prose fields", () => {
    const src = readComponent("EditorialUnderstandingSection.tsx");
    assert.match(src, /synthesis_narrative/);
    assert.match(src, /story_kind/);
    assert.match(src, /narrative_drivers/);
  });

  it("40. manuscript characteristics grouped by category", () => {
    const src = readComponent("ManuscriptCharacteristicsSection.tsx");
    assert.match(src, /Story Identity/);
    assert.match(src, /category/);
  });

  it("41. what happens next boundaries", () => {
    const src = readComponent("EditorialProfileNextSteps.tsx");
    assert.match(src, /No specialist has been activated/);
    assert.match(src, /No manuscript has been shared/);
    assert.match(src, /later step/);
  });

  it("42. confidence section shows label not raw enum", () => {
    const src = readComponent("ConfidenceUncertaintySection.tsx");
    assert.match(src, /overall_confidence_label/);
    assert.doesNotMatch(src, /overall_confidence === \"high\"/);
  });

  it("43. internal lifecycle enums not in state messages", async () => {
    setDevFixture("awaiting_eic_confirmation");
    const result = await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      manuscriptTitle: "Book",
      versionLabel: "v1",
    });
    assert.doesNotMatch(result.message, /awaiting_eic_confirmation/);
  });

  it("44. presentation does not expose expert keys", async () => {
    setDevFixture("active");
    const result = await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      manuscriptTitle: "Book",
      versionLabel: "v1",
    });
    const blob = JSON.stringify(result.presentation);
    assert.doesNotMatch(blob, /military_expert|literary_agent|developmental_editor/);
  });

  it("45. section titles match contract", async () => {
    setDevFixture("active");
    const result = await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      manuscriptTitle: "Book",
      versionLabel: "v1",
    });
    for (const section of result.presentation!.sections) {
      assert.equal(section.title, AUTHOR_FACING_SECTION_TITLES[section.section_key]);
    }
  });

  it("46. risks section separate from opportunities in view order", () => {
    const src = readComponent("EditorialProfileView.tsx");
    const opp = src.indexOf("<ImprovementOpportunitiesSection");
    const risks = src.indexOf("<EditorialRisksSection");
    assert.ok(opp >= 0 && risks > opp);
  });

  it("47. specialist framing copy in section", () => {
    const src = readComponent("SpecialistSupportSection.tsx");
    assert.match(src, /AUTHOR_FACING_SPECIALIST_FRAMING/);
  });

  it("48. loader returns null presentation for non-active states", async () => {
    setDevFixture("blocked");
    const result = await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      manuscriptTitle: "Book",
      versionLabel: "v1",
    });
    assert.equal(result.presentation, null);
  });

  it("49. last updated label formatted when active", async () => {
    setDevFixture("active");
    const result = await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      manuscriptTitle: "Book",
      versionLabel: "v1",
    });
    assert.ok(result.presentation!.lastUpdatedLabel);
  });

  it("50. status label is author-facing when active", async () => {
    setDevFixture("active");
    const result = await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      manuscriptTitle: "Book",
      versionLabel: "v1",
    });
    assert.equal(result.presentation!.statusLabel, "Current understanding");
  });

  it("51. no feature flag names in UI components", () => {
    const src = readComponent("EditorialProfileStateView.tsx");
    assert.doesNotMatch(src, /STUDIO_EDITORIAL_PROFILE/);
  });

  it("52. evidence list accessible structure", () => {
    const src = readComponent("presentation-utils.tsx");
    assert.match(src, /<ul/);
    assert.match(src, /locator_label/);
  });

  it("53. commercial enablement remains off in feature flag module", async () => {
    enableProfileFlags();
    const { editorialProfileEnablesCommercialExperts, editorialProfileGrantsSpecialistAccess } =
      await import("@/lib/editorial-profile/feature-flag.ts");
    assert.equal(editorialProfileEnablesCommercialExperts(), false);
    assert.equal(editorialProfileGrantsSpecialistAccess(), false);
  });

  it("54. active fixture profile is not mutated by loader", async () => {
    setDevFixture("active");
    const before = resolveStudioEditorialProfileFixture({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
    });
    await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      manuscriptTitle: "Book",
      versionLabel: "v1",
    });
    const after = resolveStudioEditorialProfileFixture({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
    });
    assert.deepEqual(before, after);
  });

  it("55. manuscript title passed through result", async () => {
    setDevFixture("blocked");
    const result = await loadEditorialProfilePresentation({
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      manuscriptTitle: "Hold Fast",
      versionLabel: "v2",
    });
    assert.equal(result.manuscriptTitle, "Hold Fast");
    assert.equal(result.versionLabel, "v2");
  });
});
