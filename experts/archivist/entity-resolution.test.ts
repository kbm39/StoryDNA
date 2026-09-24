import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARCHIVIST_CERTIFICATION_ENTITY_CATALOG,
  ARCHIVIST_FIXTURE_ENTITY_IDS,
} from "./entity-catalog.ts";
import {
  applyArchivistEntityResolution,
  resolveArchivistEntityIdentity,
} from "./entity-resolution.ts";
import { parseAndEnvelopeArchivistModelOutput } from "./model-output.ts";
import { FIXTURE_CONTENT_HASH, FIXTURE_MANUSCRIPT_ID, FIXTURE_MANUSCRIPT_VERSION_ID } from "./fixtures.ts";
import {
  ARCHIVIST_V2_AMBIGUOUS_JOHN_PAYLOAD,
  ARCHIVIST_V2_SPOOFED_ENTITY_ID_PAYLOAD,
  ARCHIVIST_V2_UNKNOWN_ENTITY_PAYLOAD,
} from "./v2-regression-fixtures.ts";

const IDENTITY = {
  manuscript_id: FIXTURE_MANUSCRIPT_ID,
  manuscript_version_id: FIXTURE_MANUSCRIPT_VERSION_ID,
  content_hash: FIXTURE_CONTENT_HASH,
};

const CONTEXT = { catalog: ARCHIVIST_CERTIFICATION_ENTITY_CATALOG };

describe("Archivist StoryDNA entity resolution", () => {
  it("resolves a unique semantic name to a fixture-owned ID", () => {
    const mara = resolveArchivistEntityIdentity("Mara", "person", CONTEXT);
    assert.equal(mara.status, "resolved");
    assert.equal(mara.entity_id, ARCHIVIST_FIXTURE_ENTITY_IDS.mara);
    const elena = resolveArchivistEntityIdentity("Elena Ward", "person", CONTEXT);
    assert.equal(elena.status, "resolved");
    assert.equal(elena.entity_id, ARCHIVIST_FIXTURE_ENTITY_IDS.elenaWard);
  });

  it("returns real candidates for an ambiguous alias and never silent-merges", () => {
    const john = resolveArchivistEntityIdentity("John", "person", CONTEXT);
    assert.equal(john.status, "ambiguous");
    assert.equal(john.candidates.length, 2);
    assert.ok(john.candidates.some((item) => item.entity_id === ARCHIVIST_FIXTURE_ENTITY_IDS.johnReeves));
    assert.ok(john.candidates.some((item) => item.entity_id === ARCHIVIST_FIXTURE_ENTITY_IDS.johnHale));
    assert.equal(john.entity_id, undefined);
  });

  it("does not fabricate an ID when no entity matches", () => {
    const nobody = resolveArchivistEntityIdentity("Nobody", "person", CONTEXT);
    assert.equal(nobody.status, "not_found");
    assert.equal(nobody.entity_id, undefined);
    assert.deepEqual(nobody.candidates, []);
  });

  it("strips a spoofed model entity_id and attaches the StoryDNA ID", () => {
    const enveloped = parseAndEnvelopeArchivistModelOutput(
      ARCHIVIST_V2_SPOOFED_ENTITY_ID_PAYLOAD,
      IDENTITY,
    );
    assert.equal(enveloped.ok, true);
    if (!enveloped.ok) return;
    const resolved = applyArchivistEntityResolution(enveloped.review, CONTEXT);
    assert.equal(resolved.canon_delta[0]?.entity.entity_id, ARCHIVIST_FIXTURE_ENTITY_IDS.mara);
    assert.notEqual(resolved.canon_delta[0]?.entity.entity_id, "spoofed-not-a-storydna-id");
    assert.equal(resolved.canon_delta[0]?.status, "candidate");
  });

  it("replaces a guessed unique ID on John with real ambiguity", () => {
    const enveloped = parseAndEnvelopeArchivistModelOutput(
      ARCHIVIST_V2_AMBIGUOUS_JOHN_PAYLOAD,
      IDENTITY,
    );
    assert.equal(enveloped.ok, true);
    if (!enveloped.ok) return;
    const resolved = applyArchivistEntityResolution(enveloped.review, CONTEXT);
    assert.equal(resolved.canon_delta[0]?.entity.resolution, "ambiguous");
    assert.equal(resolved.canon_delta[0]?.entity.entity_id, undefined);
    assert.equal(resolved.entity_ambiguities.length, 1);
    assert.equal(resolved.entity_ambiguities[0]?.candidate_entities.length, 2);
  });

  it("drops invented IDs and fake candidates for an unknown alias", () => {
    const enveloped = parseAndEnvelopeArchivistModelOutput(
      ARCHIVIST_V2_UNKNOWN_ENTITY_PAYLOAD,
      IDENTITY,
    );
    assert.equal(enveloped.ok, true);
    if (!enveloped.ok) return;
    const resolved = applyArchivistEntityResolution(enveloped.review, CONTEXT);
    assert.equal(resolved.canon_delta[0]?.entity.resolution, "not_found");
    assert.equal(resolved.canon_delta[0]?.entity.entity_id, undefined);
    assert.equal(resolved.entity_ambiguities.length, 0);
  });
});
