import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARCHIVIST_LIVE_MODEL_CERTIFIED,
  isArchivistLiveExecutionAllowed,
} from "./live-flags.ts";
import { ARCHIVIST_CONSTITUTION } from "./constitution.ts";
import { archivistRuntimeDefinition } from "./runtime-definition.ts";
import {
  assertReckoningRevised11SourcePin,
  RECKONING_REVISED_11_SOURCE_PIN,
} from "./reckoning-revised-11-source-pin.ts";
import { HOLD_FAST_PILOT_PLAN } from "./hold-fast-pilot.ts";

describe("REVISED-11 Archivist source pin", () => {
  it("pins the ingested manuscript and refuses identity drift", () => {
    assert.equal(
      RECKONING_REVISED_11_SOURCE_PIN.source_filename,
      "HoldFast_BookOne_TheReckoning_REVISED-11.docx",
    );
    assert.equal(RECKONING_REVISED_11_SOURCE_PIN.manuscript_id, "4bd68788-6e4e-415f-84f6-b63e87cc2f52");
    assert.equal(
      RECKONING_REVISED_11_SOURCE_PIN.manuscript_version_id,
      "ad064381-b754-4669-8458-74f040d8bab3",
    );
    assert.equal(
      RECKONING_REVISED_11_SOURCE_PIN.content_hash,
      "d901d178fa03e526d1f1248f313650b4455f2c9b21dded7904fc40d24714b503",
    );
    assert.equal(RECKONING_REVISED_11_SOURCE_PIN.version_number, 1);
    assert.equal(
      RECKONING_REVISED_11_SOURCE_PIN.source_docx_sha256,
      "af22f99e7e15e596ba74a1c9687e53c40e7ce3235b4e4b648b8b41887b2c70fa",
    );
    assert.equal(RECKONING_REVISED_11_SOURCE_PIN.analytical_word_count, 110156);
    assert.equal(RECKONING_REVISED_11_SOURCE_PIN.model, "claude-haiku-4-5-20251001");
    assert.equal(RECKONING_REVISED_11_SOURCE_PIN.authorized_to_run, false);
    assert.equal(RECKONING_REVISED_11_SOURCE_PIN.series_id, null);
    const matching = {
      manuscript_id: RECKONING_REVISED_11_SOURCE_PIN.manuscript_id,
      manuscript_version_id: RECKONING_REVISED_11_SOURCE_PIN.manuscript_version_id,
      version_number: RECKONING_REVISED_11_SOURCE_PIN.version_number,
      content_hash: RECKONING_REVISED_11_SOURCE_PIN.content_hash,
      source_filename: RECKONING_REVISED_11_SOURCE_PIN.source_filename,
      source_docx_sha256: RECKONING_REVISED_11_SOURCE_PIN.source_docx_sha256,
      analytical_word_count: RECKONING_REVISED_11_SOURCE_PIN.analytical_word_count,
      model: RECKONING_REVISED_11_SOURCE_PIN.model,
    };
    assert.doesNotThrow(() => assertReckoningRevised11SourcePin(matching));
    assert.throws(
      () => assertReckoningRevised11SourcePin({ ...matching, manuscript_id: "0".repeat(36) }),
      /RECKONING_PILOT_PIN_MISMATCH:manuscript_id/,
    );
    assert.throws(
      () =>
        assertReckoningRevised11SourcePin({
          ...matching,
          manuscript_version_id: "0".repeat(36),
        }),
      /RECKONING_PILOT_PIN_MISMATCH:manuscript_version_id/,
    );
    assert.throws(
      () => assertReckoningRevised11SourcePin({ ...matching, version_number: 2 }),
      /RECKONING_PILOT_PIN_MISMATCH:version_number/,
    );
    assert.throws(
      () => assertReckoningRevised11SourcePin({ ...matching, content_hash: "0".repeat(64) }),
      /RECKONING_PILOT_PIN_MISMATCH:content_hash/,
    );
    assert.throws(
      () =>
        assertReckoningRevised11SourcePin({
          ...matching,
          source_filename: "HoldFast_BookOne_TheReckoning_QueryReady.docx",
        }),
      /RECKONING_PILOT_PIN_MISMATCH:source_filename/,
    );
    assert.throws(
      () =>
        assertReckoningRevised11SourcePin({
          ...matching,
          source_docx_sha256: "0".repeat(64),
        }),
      /RECKONING_PILOT_PIN_MISMATCH:source_docx_sha256/,
    );
    assert.throws(
      () => assertReckoningRevised11SourcePin({ ...matching, analytical_word_count: 107797 }),
      /RECKONING_PILOT_PIN_MISMATCH:analytical_word_count/,
    );
    assert.throws(
      () => assertReckoningRevised11SourcePin({ ...matching, model: "claude-opus-4-8" }),
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
  });
});
