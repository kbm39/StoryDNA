import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARCHIVIST_PAID_CERT_ACK,
  ARCHIVIST_PAID_SCOPE_CASES,
  ARCHIVIST_PAID_SMOKE_MODEL,
  assertPaidCertificationAcknowledged,
  parsePaidCertificationArgv,
  scorePaidScopeCase,
} from "./live-paid-certification.ts";
import { ARCHIVIST_LIVE_MODEL_CERTIFIED } from "./live-flags.ts";
import { createArchivistLiveProvider } from "./live-provider.ts";
import { HOLD_FAST_PILOT_PLAN } from "./hold-fast-pilot.ts";
import { ARCHIVIST_SMOKE_20260922_V2_EVIDENCE } from "./session-archivist-smoke-20260922-v2.ts";
import {
  ARCHIVIST_SMOKE_20260922_V3_SESSION_ID,
  ARCHIVIST_V3_AUTHORIZED,
} from "./v3-certification-criteria.ts";

describe("Archivist paid scope certification", () => {
  it("requires the founder ack token and never flips live gates", () => {
    assert.equal(ARCHIVIST_LIVE_MODEL_CERTIFIED, false);
    assert.equal(HOLD_FAST_PILOT_PLAN.run_now, false);
    assert.throws(() => assertPaidCertificationAcknowledged(undefined));
    assert.throws(() => assertPaidCertificationAcknowledged("yes"));
    assert.doesNotThrow(() => assertPaidCertificationAcknowledged(ARCHIVIST_PAID_CERT_ACK));
    assert.throws(() => createArchivistLiveProvider({ allowPaidCertificationRun: true }));
  });

  it("pins a scoped three-case Haiku smoke, not Hold Fast", () => {
    assert.equal(ARCHIVIST_PAID_SCOPE_CASES.length, 3);
    assert.equal(ARCHIVIST_PAID_SMOKE_MODEL, "claude-haiku-4-5-20251001");
    assert.equal(ARCHIVIST_V3_AUTHORIZED, false);
    assert.notEqual(ARCHIVIST_SMOKE_20260922_V2_EVIDENCE.session_id, ARCHIVIST_SMOKE_20260922_V3_SESSION_ID);
    assert.ok(ARCHIVIST_PAID_SCOPE_CASES.every((item) => !/hold fast/i.test(item.manuscript_text)));
    assert.deepEqual(
      parsePaidCertificationArgv([
        "--acknowledge",
        ARCHIVIST_PAID_CERT_ACK,
        "--session-id",
        "archivist-smoke-test",
        "--max-cost-usd",
        "1",
      ]),
      {
        acknowledge: ARCHIVIST_PAID_CERT_ACK,
        sessionId: "archivist-smoke-test",
        maxCostUsd: 1,
      },
    );
  });

  it("scores confirmed-count, both-side evidence, and candidate-only canon", () => {
    const contradiction = ARCHIVIST_PAID_SCOPE_CASES[0]!;
    const clean = ARCHIVIST_PAID_SCOPE_CASES[2]!;
    const emptyCost = {
      expert_key: "archivist",
      execution_mode: "live" as const,
      provider: "anthropic" as const,
      model: ARCHIVIST_PAID_SMOKE_MODEL,
      call_count: 1,
      input_tokens: 10,
      output_tokens: 10,
      cached_tokens: 0,
      cache_creation_tokens: 0,
      total_cost_usd: 0.01,
      runtime_ms: 1,
      token_counts: "exact" as const,
      cost_status: "exact" as const,
    };

    const miss = scorePaidScopeCase(contradiction, {
      review: null,
      canon_writes: { accepted_facts: 0, accepted_bible_revisions: 0, persisted: false },
      cost: emptyCost,
      error_code: "structured_output_invalid",
    });
    assert.equal(miss.passed, false);

    const cleanPass = scorePaidScopeCase(clean, {
      review: {
        findings: [],
        canon_delta: [],
        entity_ambiguities: [],
      } as never,
      canon_writes: { accepted_facts: 0, accepted_bible_revisions: 0, persisted: false },
      cost: emptyCost,
    });
    assert.equal(cleanPass.passed, true);
  });
});
