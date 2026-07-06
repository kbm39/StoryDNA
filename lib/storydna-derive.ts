import "server-only";
import type { Evidence, StoryDnaData } from "@/lib/types";

/** Whitespace-normalized, lowercased text for verbatim matching. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
}

/**
 * Verify a quote is really in the manuscript. Exact (normalized) substring, with
 * a long-prefix fallback so trivial trailing differences don't fail a real quote.
 */
function verifyQuote(quote: string, hay: string): boolean {
  const q = normalize(quote);
  if (q.length < 10) return false; // too short to be meaningful evidence
  if (hay.includes(q)) return true;
  const probe = q.slice(0, Math.min(q.length, 60));
  return probe.length >= 20 && hay.includes(probe);
}

function verifyList(ev: Evidence[], hay: string): Evidence[] {
  return ev.map((e) => ({ ...e, verified: verifyQuote(e.quote, hay) }));
}

function ratio(ev: Evidence[]): number {
  if (ev.length === 0) return 0;
  return ev.filter((e) => e.verified).length / ev.length;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const pct = (n: number) => Math.round(clamp01(n) * 100);
const verifiedCount = (ev: Evidence[]) => ev.filter((e) => e.verified).length;

/**
 * Verify every evidence quote against the manuscript and derive the four
 * confidence scores from verified-evidence density + coverage. Deterministic —
 * no model self-rating. Mutates and returns the same data object.
 */
export function deriveStoryDna(
  data: StoryDnaData,
  manuscriptText: string,
  coverage: "full" | "notes",
): StoryDnaData {
  const hay = normalize(manuscriptText);

  data.summary.evidence = verifyList(data.summary.evidence, hay);
  data.about.evidence = verifyList(data.about.evidence, hay);
  data.emotional_promise.evidence = verifyList(data.emotional_promise.evidence, hay);
  data.themes.proposed = data.themes.proposed.map((t) => ({
    ...t,
    evidence: verifyList(t.evidence, hay),
  }));
  if (data.protagonist.evidence) {
    data.protagonist.evidence = verifyList(data.protagonist.evidence, hay);
  }

  const cov = coverage === "full" ? 1 : 0.75;
  const coverageLabel =
    coverage === "full"
      ? "Full manuscript analyzed"
      : "Analyzed via section notes (long manuscript)";

  const summaryR = ratio(data.summary.evidence);
  const aboutR = ratio(data.about.evidence);
  const themesWithEvidence = data.themes.proposed.filter((t) =>
    t.evidence.some((e) => e.verified),
  ).length;
  const themesTotal = data.themes.proposed.length || 1;
  const themesR = themesWithEvidence / themesTotal;
  const protoEv = data.protagonist.evidence ?? [];
  const protoR = protoEv.length ? ratio(protoEv) : 0.5;
  const character = clamp01(data.protagonist.confidence * (0.6 + 0.4 * protoR));

  data.confidence = {
    story: {
      value: pct(cov * (0.5 + 0.5 * summaryR)),
      rationale: `${coverageLabel}; ${verifiedCount(data.summary.evidence)}/${data.summary.evidence.length} summary passages traced to the text.`,
    },
    theme: {
      value: pct(cov * (0.4 + 0.6 * themesR)),
      rationale: `${themesWithEvidence}/${data.themes.proposed.length} themes backed by a verbatim passage.`,
    },
    character: {
      value: pct(character),
      rationale: `Protagonist signal ${Math.round(data.protagonist.confidence * 100)}%${
        protoEv.length ? `, ${verifiedCount(protoEv)}/${protoEv.length} supporting passages verified` : ""
      }.`,
    },
    message: {
      value: pct(cov * (0.4 + 0.6 * aboutR)),
      rationale: `${verifiedCount(data.about.evidence)}/${data.about.evidence.length} passages support this interpretation.`,
    },
  };

  return data;
}
