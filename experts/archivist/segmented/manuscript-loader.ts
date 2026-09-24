/**
 * Server-oriented pinned-manuscript loader. Persistence is injected.
 * Execution must not read a local Downloads path.
 */

import { createHash } from "node:crypto";
import { countManuscriptWords } from "@/lib/word-count.ts";
import {
  assertReckoningRevised11SourcePin,
  RECKONING_REVISED_11_SOURCE_PIN,
} from "../reckoning-revised-11-source-pin.ts";
import {
  assertReckoningRevised112SourcePin,
  RECKONING_REVISED_11_2_SOURCE_PIN,
} from "../reckoning-revised-11-2-source-pin.ts";
import {
  assertReckoningRevised13SourcePin,
  RECKONING_REVISED_13_SOURCE_PIN,
} from "../reckoning-revised-13-source-pin.ts";
import { SourcePinMismatchError } from "./errors.ts";
import type { PinnedManuscriptSnapshot, PinnedManuscriptStore } from "./types.ts";

export function storyDnaContentHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function createMemoryManuscriptStore(
  snapshot: PinnedManuscriptSnapshot,
): PinnedManuscriptStore {
  return {
    loadPinnedVersion(args) {
      if (
        snapshot.manuscript_id !== args.manuscript_id ||
        snapshot.manuscript_version_id !== args.manuscript_version_id ||
        snapshot.content_hash !== args.content_hash
      ) {
        return null;
      }
      return snapshot;
    },
  };
}

export function assertPinnedSnapshotIdentity(snapshot: PinnedManuscriptSnapshot): void {
  try {
    assertReckoningRevised11SourcePin({
      manuscript_id: snapshot.manuscript_id,
      manuscript_version_id: snapshot.manuscript_version_id,
      version_number: snapshot.version_number,
      content_hash: snapshot.content_hash,
      source_filename: snapshot.source_filename,
      source_docx_sha256: snapshot.source_docx_sha256,
      analytical_word_count: snapshot.analytical_word_count,
      model: RECKONING_REVISED_11_SOURCE_PIN.model,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const field = message.split(":").pop() ?? "identity";
    throw new SourcePinMismatchError(field);
  }
}

export async function loadPinnedReckoningRevised11(
  store: PinnedManuscriptStore,
): Promise<PinnedManuscriptSnapshot> {
  const pin = RECKONING_REVISED_11_SOURCE_PIN;
  const loaded = await store.loadPinnedVersion({
    manuscript_id: pin.manuscript_id,
    manuscript_version_id: pin.manuscript_version_id,
    content_hash: pin.content_hash,
  });
  if (!loaded) {
    throw new SourcePinMismatchError("not_found");
  }
  assertPinnedSnapshotIdentity(loaded);
  if (!loaded.is_current) {
    throw new SourcePinMismatchError("is_current");
  }
  if (!loaded.extracted_text.trim()) {
    throw new SourcePinMismatchError("extracted_text_empty");
  }
  const computedHash = storyDnaContentHash(loaded.extracted_text);
  if (computedHash !== pin.content_hash) {
    throw new SourcePinMismatchError("content_hash");
  }
  const words = countManuscriptWords(loaded.extracted_text);
  if (words !== pin.analytical_word_count) {
    throw new SourcePinMismatchError("analytical_word_count");
  }
  return loaded;
}

export function assertPinnedRevised112SnapshotIdentity(snapshot: PinnedManuscriptSnapshot): void {
  try {
    assertReckoningRevised112SourcePin({
      manuscript_id: snapshot.manuscript_id,
      manuscript_version_id: snapshot.manuscript_version_id,
      version_number: snapshot.version_number,
      content_hash: snapshot.content_hash,
      source_filename: snapshot.source_filename,
      source_docx_sha256: snapshot.source_docx_sha256,
      analytical_word_count: snapshot.analytical_word_count,
      model: RECKONING_REVISED_11_2_SOURCE_PIN.model,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const field = message.split(":").pop() ?? "identity";
    throw new SourcePinMismatchError(field);
  }
}

export async function loadPinnedReckoningRevised112(
  store: PinnedManuscriptStore,
): Promise<PinnedManuscriptSnapshot> {
  const pin = RECKONING_REVISED_11_2_SOURCE_PIN;
  const loaded = await store.loadPinnedVersion({
    manuscript_id: pin.manuscript_id,
    manuscript_version_id: pin.manuscript_version_id,
    content_hash: pin.content_hash,
  });
  if (!loaded) {
    throw new SourcePinMismatchError("not_found");
  }
  assertPinnedRevised112SnapshotIdentity(loaded);
  if (!loaded.is_current) {
    throw new SourcePinMismatchError("is_current");
  }
  if (!loaded.extracted_text.trim()) {
    throw new SourcePinMismatchError("extracted_text_empty");
  }
  const computedHash = storyDnaContentHash(loaded.extracted_text);
  if (computedHash !== pin.content_hash) {
    throw new SourcePinMismatchError("content_hash");
  }
  const words = countManuscriptWords(loaded.extracted_text);
  if (words !== pin.analytical_word_count) {
    throw new SourcePinMismatchError("analytical_word_count");
  }
  return loaded;
}

export function assertPinnedRevised13SnapshotIdentity(snapshot: PinnedManuscriptSnapshot): void {
  try {
    assertReckoningRevised13SourcePin({
      manuscript_id: snapshot.manuscript_id,
      manuscript_version_id: snapshot.manuscript_version_id,
      version_number: snapshot.version_number,
      content_hash: snapshot.content_hash,
      source_filename: snapshot.source_filename,
      source_docx_sha256: snapshot.source_docx_sha256,
      analytical_word_count: snapshot.analytical_word_count,
      model: RECKONING_REVISED_13_SOURCE_PIN.model,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const field = message.split(":").pop() ?? "identity";
    throw new SourcePinMismatchError(field);
  }
}

export async function loadPinnedReckoningRevised13(
  store: PinnedManuscriptStore,
): Promise<PinnedManuscriptSnapshot> {
  const pin = RECKONING_REVISED_13_SOURCE_PIN;
  const loaded = await store.loadPinnedVersion({
    manuscript_id: pin.manuscript_id,
    manuscript_version_id: pin.manuscript_version_id,
    content_hash: pin.content_hash,
  });
  if (!loaded) {
    throw new SourcePinMismatchError("not_found");
  }
  assertPinnedRevised13SnapshotIdentity(loaded);
  if (!loaded.is_current) {
    throw new SourcePinMismatchError("is_current");
  }
  if (!loaded.extracted_text.trim()) {
    throw new SourcePinMismatchError("extracted_text_empty");
  }
  const computedHash = storyDnaContentHash(loaded.extracted_text);
  if (computedHash !== pin.content_hash) {
    throw new SourcePinMismatchError("content_hash");
  }
  const words = countManuscriptWords(loaded.extracted_text);
  if (words !== pin.analytical_word_count) {
    throw new SourcePinMismatchError("analytical_word_count");
  }
  return loaded;
}

export async function loadManuscriptSnapshot(
  store: PinnedManuscriptStore,
  identity: {
    manuscript_id: string;
    manuscript_version_id: string;
    content_hash: string;
  },
): Promise<PinnedManuscriptSnapshot> {
  const loaded = await store.loadPinnedVersion(identity);
  if (!loaded) {
    throw new SourcePinMismatchError("not_found");
  }
  if (!loaded.extracted_text.trim()) {
    throw new SourcePinMismatchError("extracted_text_empty");
  }
  const computedHash = storyDnaContentHash(loaded.extracted_text);
  if (computedHash !== identity.content_hash) {
    throw new SourcePinMismatchError("content_hash");
  }
  return loaded;
}
