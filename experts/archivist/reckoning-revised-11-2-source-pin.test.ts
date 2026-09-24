import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARCHIVIST_LIVE_MODEL_CERTIFIED,
  isArchivistLiveExecutionAllowed,
} from "./live-flags.ts";
import { ARCHIVIST_CONSTITUTION } from "./constitution.ts";
import { archivistRuntimeDefinition } from "./runtime-definition.ts";
import { RECKONING_REVISED_11_SOURCE_PIN } from "./reckoning-revised-11-source-pin.ts";
import {
  assertReckoningRevised112SourcePin,
  RECKONING_REVISED_11_2_SOURCE_PIN,
} from "./reckoning-revised-11-2-source-pin.ts";
import { HOLD_FAST_PILOT_PLAN } from "./hold-fast-pilot.ts";

describe("REVISED-11-2 Archivist source pin", () => {
  it("pins the ingested manuscript and refuses every identity-field drift", () => {
    assert.equal(
      RECKONING_REVISED_11_2_SOURCE_PIN.source_filename,
      "HoldFast_BookOne_TheReckoning_REVISED-11-2.docx",
    );
    assert.equal(RECKONING_REVISED_11_2_SOURCE_PIN.manuscript_id, "23def5e6-90b7-4305-a842-53637f959190");
    assert.equal(
      RECKONING_REVISED_11_2_SOURCE_PIN.manuscript_version_id,
      "8e93109b-4572-43bf-88da-c8713d0da00f",
    );
    assert.equal(
      RECKONING_REVISED_11_2_SOURCE_PIN.content_hash,
      "dbdd8284a54d236a481309a7bdd81fdd540b5eff7bafce54c117bc4d681631cd",
    );
    assert.equal(RECKONING_REVISED_11_2_SOURCE_PIN.version_number, 1);
    assert.equal(
      RECKONING_REVISED_11_2_SOURCE_PIN.source_docx_sha256,
      "78af9f7b62ff0aa1d4d3fb038ccdd9320a5beb50a5923cb4b9fb68f69daf8c6e",
    );
    assert.equal(RECKONING_REVISED_11_2_SOURCE_PIN.analytical_word_count, 109907);
    assert.equal(RECKONING_REVISED_11_2_SOURCE_PIN.model, "claude-haiku-4-5-20251001");
    assert.equal(RECKONING_REVISED_11_2_SOURCE_PIN.provider, "anthropic");
    assert.equal(RECKONING_REVISED_11_2_SOURCE_PIN.authorized_to_run, false);
    assert.equal(RECKONING_REVISED_11_2_SOURCE_PIN.series_id, null);
    assert.notEqual(
      RECKONING_REVISED_11_2_SOURCE_PIN.manuscript_id,
      RECKONING_REVISED_11_SOURCE_PIN.manuscript_id,
    );
    assert.notEqual(
      RECKONING_REVISED_11_2_SOURCE_PIN.content_hash,
      RECKONING_REVISED_11_SOURCE_PIN.content_hash,
    );
    const matching = {
      manuscript_id: RECKONING_REVISED_11_2_SOURCE_PIN.manuscript_id,
      manuscript_version_id: RECKONING_REVISED_11_2_SOURCE_PIN.manuscript_version_id,
      version_number: RECKONING_REVISED_11_2_SOURCE_PIN.version_number,
      content_hash: RECKONING_REVISED_11_2_SOURCE_PIN.content_hash,
      source_filename: RECKONING_REVISED_11_2_SOURCE_PIN.source_filename,
      source_docx_sha256: RECKONING_REVISED_11_2_SOURCE_PIN.source_docx_sha256,
      analytical_word_count: RECKONING_REVISED_11_2_SOURCE_PIN.analytical_word_count,
      model: RECKONING_REVISED_11_2_SOURCE_PIN.model,
    };
    assert.doesNotThrow(() => assertReckoningRevised112SourcePin(matching));
    assert.throws(
      () => assertReckoningRevised112SourcePin({ ...matching, manuscript_id: "0".repeat(36) }),
      /RECKONING_PILOT_PIN_MISMATCH:manuscript_id/,
    );
    assert.throws(
      () =>
        assertReckoningRevised112SourcePin({
          ...matching,
          manuscript_version_id: "0".repeat(36),
        }),
      /RECKONING_PILOT_PIN_MISMATCH:manuscript_version_id/,
    );
    assert.throws(
      () => assertReckoningRevised112SourcePin({ ...matching, version_number: 2 }),
      /RECKONING_PILOT_PIN_MISMATCH:version_number/,
    );
    assert.throws(
      () => assertReckoningRevised112SourcePin({ ...matching, content_hash: "0".repeat(64) }),
      /RECKONING_PILOT_PIN_MISMATCH:content_hash/,
    );
    assert.throws(
      () =>
        assertReckoningRevised112SourcePin({
          ...matching,
          source_filename: "HoldFast_BookOne_TheReckoning_REVISED-11.docx",
        }),
      /RECKONING_PILOT_PIN_MISMATCH:source_filename/,
    );
    assert.throws(
      () =>
        assertReckoningRevised112SourcePin({
          ...matching,
          source_docx_sha256: "0".repeat(64),
        }),
      /RECKONING_PILOT_PIN_MISMATCH:source_docx_sha256/,
    );
    assert.throws(
      () => assertReckoningRevised112SourcePin({ ...matching, analytical_word_count: 110156 }),
      /RECKONING_PILOT_PIN_MISMATCH:analytical_word_count/,
    );
    assert.throws(
      () => assertReckoningRevised112SourcePin({ ...matching, model: "claude-opus-4-8" }),
      /RECKONING_PILOT_PIN_MISMATCH:model/,
    );
  });

  it("does not authorize execution, runtime, Studio, or a Hold Fast run", () => {
    assert.equal(ARCHIVIST_LIVE_MODEL_CERTIFIED, true);
    assert.equal(isArchivistLiveExecutionAllowed(), false);
    assert.equal(ARCHIVIST_CONSTITUTION.execution_wired, false);
    assert.equal(ARCHIVIST_CONSTITUTION.studio_selectable, false);
    assert.equal(archivistRuntimeDefinition().enabled, false);
    assert.equal(HOLD_FAST_PILOT_PLAN.run_now, false);
    assert.equal(RECKONING_REVISED_11_SOURCE_PIN.authorized_to_run, false);
    assert.equal(RECKONING_REVISED_11_2_SOURCE_PIN.authorized_to_run, false);
  });
});
