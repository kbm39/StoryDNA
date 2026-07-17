import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EVIDENCE_PROFILE_KEYS,
  EVIDENCE_PROFILES,
  getEvidenceProfile,
  isEvidenceProfileKey,
} from "./evidence-profiles.ts";

describe("evidence-profiles", () => {
  it("defines all required Phase 1 profiles", () => {
    for (const key of EVIDENCE_PROFILE_KEYS) {
      assert.ok(EVIDENCE_PROFILES[key], `Missing profile: ${key}`);
    }
    assert.equal(EVIDENCE_PROFILE_KEYS.length, 10);
  });

  it("each profile requires at least one evidence record for material outputs", () => {
    for (const key of EVIDENCE_PROFILE_KEYS) {
      const profile = EVIDENCE_PROFILES[key];
      for (const req of profile.per_output_requirements) {
        assert.ok(req.minimum_records >= 1, `${key} ${req.output_type} min records`);
      }
    }
  });

  it("isEvidenceProfileKey validates keys", () => {
    assert.equal(isEvidenceProfileKey("EDITORIAL"), true);
    assert.equal(isEvidenceProfileKey("INVALID"), false);
  });

  it("getEvidenceProfile returns profile or throws", () => {
    assert.equal(getEvidenceProfile("EDITORIAL").key, "EDITORIAL");
    assert.throws(() => getEvidenceProfile("NOPE" as never));
  });

  it("EDITORIAL profile requires manuscript anchors", () => {
    const editorial = EVIDENCE_PROFILES.EDITORIAL;
    assert.equal(editorial.manuscript_anchor_requirements.require_locator, true);
    assert.equal(editorial.insufficient_evidence_behavior, "block");
  });
});
