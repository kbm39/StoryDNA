import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARCHIVIST_LIVE_MODEL_CERTIFIED,
  isArchivistLiveExecutionAllowed,
} from "./live-flags.ts";
import { ARCHIVIST_CONSTITUTION } from "./constitution.ts";
import { archivistRuntimeDefinition } from "./runtime-definition.ts";
import { RECKONING_REVISED_11_2_SOURCE_PIN } from "./reckoning-revised-11-2-source-pin.ts";
import {
  assertReckoningRevised13SourcePin,
  RECKONING_REVISED_13_SOURCE_PIN,
} from "./reckoning-revised-13-source-pin.ts";

describe("REVISED-13 Archivist source pin", () => {
  it("pins the ingested manuscript and refuses identity drift", () => {
    assert.equal(
      RECKONING_REVISED_13_SOURCE_PIN.source_filename,
      "HoldFast_BookOne_TheReckoning_REVISED-13.docx",
    );
    assert.equal(RECKONING_REVISED_13_SOURCE_PIN.manuscript_id, "9478ddf1-4564-4019-96a4-0d1852ee56f9");
    assert.equal(
      RECKONING_REVISED_13_SOURCE_PIN.manuscript_version_id,
      "19ec5084-3426-4a91-a946-05895bb3e556",
    );
    assert.equal(
      RECKONING_REVISED_13_SOURCE_PIN.content_hash,
      "d1e3fb40bb864399c1459414e5286e7d3806740dd0788343c298620676602a8f",
    );
    assert.equal(RECKONING_REVISED_13_SOURCE_PIN.analytical_word_count, 109887);
    assert.equal(RECKONING_REVISED_13_SOURCE_PIN.model, "claude-haiku-4-5-20251001");
    assert.equal(RECKONING_REVISED_13_SOURCE_PIN.authorized_to_run, false);
    assert.notEqual(
      RECKONING_REVISED_13_SOURCE_PIN.manuscript_id,
      RECKONING_REVISED_11_2_SOURCE_PIN.manuscript_id,
    );
    const matching = {
      manuscript_id: RECKONING_REVISED_13_SOURCE_PIN.manuscript_id,
      manuscript_version_id: RECKONING_REVISED_13_SOURCE_PIN.manuscript_version_id,
      version_number: RECKONING_REVISED_13_SOURCE_PIN.version_number,
      content_hash: RECKONING_REVISED_13_SOURCE_PIN.content_hash,
      source_filename: RECKONING_REVISED_13_SOURCE_PIN.source_filename,
      source_docx_sha256: RECKONING_REVISED_13_SOURCE_PIN.source_docx_sha256,
      analytical_word_count: RECKONING_REVISED_13_SOURCE_PIN.analytical_word_count,
      model: RECKONING_REVISED_13_SOURCE_PIN.model,
    };
    assert.doesNotThrow(() => assertReckoningRevised13SourcePin(matching));
    assert.throws(
      () => assertReckoningRevised13SourcePin({ ...matching, manuscript_id: "0".repeat(36) }),
      /RECKONING_REVISED_13_PIN_MISMATCH:manuscript_id/,
    );
  });

  it("keeps public live, runtime, and Studio closed", () => {
    assert.equal(ARCHIVIST_LIVE_MODEL_CERTIFIED, true);
    assert.equal(isArchivistLiveExecutionAllowed(), false);
    assert.equal(ARCHIVIST_CONSTITUTION.execution_wired, false);
    assert.equal(ARCHIVIST_CONSTITUTION.studio_selectable, false);
    assert.equal(archivistRuntimeDefinition().enabled, false);
  });
});
