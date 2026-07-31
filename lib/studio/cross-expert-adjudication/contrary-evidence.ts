import { excerptInManuscript, normalizeAuditText } from "./text-normalize.ts";
import type {
  ContraryEvidenceQuality,
  ContraryEvidenceScore,
  CrossExpertNormalizedFinding,
} from "./types.ts";

function contrarySupportsConcern(excerpt: string, finding: CrossExpertNormalizedFinding): boolean {
  const normalized = normalizeAuditText(excerpt);
  const concern = normalizeAuditText(`${finding.title} ${finding.summary}`);
  const supportTerms = ["already", "explicit", "states", "shows", "confirms", "earlier", "prior"];
  return supportTerms.some((term) => normalized.includes(term) && concern.includes(term.slice(0, 4)));
}

export function scoreContraryEvidence(args: {
  readonly finding: CrossExpertNormalizedFinding;
  readonly manuscriptText: string;
}): readonly ContraryEvidenceScore[] {
  const { finding, manuscriptText } = args;
  return finding.contraryEvidence.map((item, index) => {
    const inManuscript = excerptInManuscript(manuscriptText, item.excerpt);
    const normalized = normalizeAuditText(item.excerpt);
    let quality: ContraryEvidenceQuality = "neutral";
    let rationale = "Contrary evidence is present but only weakly connected to the concern.";

    if (!inManuscript) {
      quality = "irrelevant";
      rationale = "Contrary excerpt could not be verified in the authoritative manuscript.";
    } else if (contrarySupportsConcern(item.excerpt, finding)) {
      quality = "supports_concern";
      rationale = "Cited contrary passage actually reinforces the original concern.";
    } else if (/fear|dread|already|explicit|trained|professional|plausible|standard|brief|status update/i.test(normalized)) {
      quality = "genuinely_weakens";
      rationale = "Passage provides a plausible in-universe counterweight to the concern.";
    } else if (/however|but|although|while|earlier|prior|consistent|earlier scene/i.test(normalized)) {
      quality = "partially_relevant";
      rationale = "Passage partially mitigates the concern without fully resolving it.";
    } else if (normalized.length < 40) {
      quality = "irrelevant";
      rationale = "Contrary excerpt is too thin to meaningfully weaken the concern.";
    }

    return Object.freeze({
      findingKey: finding.findingKey,
      contraryIndex: index,
      quality,
      rationale,
      locator: item.locator ?? null,
    });
  });
}

export function summarizeContraryEvidenceQuality(
  scores: readonly ContraryEvidenceScore[],
): Record<ContraryEvidenceQuality, number> {
  const summary: Record<ContraryEvidenceQuality, number> = {
    genuinely_weakens: 0,
    partially_relevant: 0,
    neutral: 0,
    irrelevant: 0,
    supports_concern: 0,
  };
  for (const score of scores) summary[score.quality]++;
  return summary;
}
