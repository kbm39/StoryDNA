import {
  extractNearbyPassage,
  locatePassage,
  splitParagraphs,
} from "./passage-utils.ts";
import type {
  EvidenceSnippet,
  QuotationLocateResult,
  RevisionCandidateRecord,
  SearchPlan,
  SearchResult,
  VersionDiffEvidence,
} from "./types.ts";

export interface SearchExecutionInput {
  plan: SearchPlan;
  currentText: string;
  priorText: string;
  revisionCandidates?: RevisionCandidateRecord[];
}

export function executeSearch(input: SearchExecutionInput): SearchResult {
  const { plan, currentText, priorText, revisionCandidates = [] } = input;

  const quotation_results = plan.quotation_checks.map((quote) =>
    locateQuotation(quote, currentText, priorText),
  );

  const version_diff = computeVersionDiff(priorText, currentText);
  const revision_changes = collectRevisionChanges(revisionCandidates, plan.root_issue);

  const current_supporting_evidence = collectSupportingEvidence(
    plan,
    currentText,
    quotation_results,
    version_diff,
  );
  const current_contrary_evidence = collectContraryEvidence(
    plan,
    currentText,
    quotation_results,
    version_diff,
    revision_changes,
  );

  return {
    concern_id: plan.concern_id,
    quotation_results,
    current_supporting_evidence,
    current_contrary_evidence,
    revision_changes,
    version_diff,
  };
}

function locateQuotation(
  quote: string,
  currentText: string,
  priorText: string,
): QuotationLocateResult {
  const inCurrent = locatePassage(currentText, quote);
  const inPrior = locatePassage(priorText, quote);
  const context = inCurrent
    ? extractNearbyPassage(currentText, quote, 1)
    : null;

  return {
    quote,
    found_in_current: Boolean(inCurrent),
    found_in_prior: Boolean(inPrior),
    current_context: context,
  };
}

function computeVersionDiff(priorText: string, currentText: string): VersionDiffEvidence {
  const priorParas = new Set(splitParagraphs(priorText));
  const currentParas = splitParagraphs(currentText);
  const currentSet = new Set(currentParas);

  const removals = [...priorParas].filter((p) => !currentSet.has(p));
  const additions = currentParas.filter((p) => !priorParas.has(p));

  const altered: string[] = [];
  for (const added of additions) {
    const probe = added.slice(0, Math.min(40, added.length)).toLowerCase();
    if (!probe) continue;
    for (const removed of removals) {
      if (removed.toLowerCase().includes(probe) || added.toLowerCase().includes(removed.slice(0, 40).toLowerCase())) {
        altered.push(added);
        break;
      }
    }
  }

  return { additions, removals, altered_paragraphs: altered };
}

function collectRevisionChanges(
  candidates: RevisionCandidateRecord[],
  rootIssue: string,
): string[] {
  const keywords = rootIssue.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
  return candidates
    .filter((c) => {
      const blob = `${c.reason ?? ""} ${c.original} ${c.revised}`.toLowerCase();
      return keywords.some((k) => blob.includes(k)) || keywords.length === 0;
    })
    .map((c) => {
      if (c.revised?.trim()) return `Revised: ${c.revised.trim()}`;
      if (c.reason?.trim()) return c.reason.trim();
      return `Change at ${c.locator ?? "unknown"}`;
    });
}

function collectSupportingEvidence(
  plan: SearchPlan,
  currentText: string,
  quotations: QuotationLocateResult[],
  versionDiff: VersionDiffEvidence,
): EvidenceSnippet[] {
  const snippets: EvidenceSnippet[] = [];

  for (const q of quotations) {
    if (q.found_in_current && q.current_context) {
      snippets.push({
        text: q.current_context,
        location: "prior_quotation_located",
        source: "current_manuscript",
        relevance: "supporting",
      });
    }
  }

  for (const kw of plan.keyword_queries) {
    const hits = findParagraphsContaining(currentText, kw);
    for (const hit of hits.slice(0, 2)) {
      if (paragraphLooksImproved(hit, plan)) continue;
      if (!paragraphMatchesIssue(hit, plan.root_issue)) continue;
      snippets.push({
        text: hit,
        location: `keyword:${kw}`,
        source: "current_manuscript",
        relevance: "supporting",
      });
    }
  }

  for (const removed of versionDiff.removals) {
    if (paragraphMatchesIssue(removed, plan.root_issue)) {
      snippets.push({
        text: removed,
        location: "version_diff:removed",
        source: "version_diff",
        relevance: "neutral",
      });
    }
  }

  return dedupeSnippets(snippets);
}

function collectContraryEvidence(
  plan: SearchPlan,
  currentText: string,
  quotations: QuotationLocateResult[],
  versionDiff: VersionDiffEvidence,
  revisionChanges: string[],
): EvidenceSnippet[] {
  const snippets: EvidenceSnippet[] = [];

  for (const q of quotations) {
    if (!q.found_in_current && q.found_in_prior) {
      snippets.push({
        text: `Prior quotation no longer present: "${q.quote.slice(0, 80)}…"`,
        location: "quotation_deleted",
        source: "version_diff",
        relevance: "contrary",
      });
    }
  }

  for (const added of versionDiff.additions) {
    const hasContraryLex = plan.contrary_lexicon.some((w) =>
      added.toLowerCase().includes(w.toLowerCase()),
    );
    const hasResolutionLex = plan.resolution_lexicon.some((w) =>
      added.toLowerCase().includes(w.toLowerCase()),
    );
    if (hasContraryLex || hasResolutionLex || paragraphMatchesIssue(added, plan.root_issue)) {
      snippets.push({
        text: added,
        location: "version_diff:added",
        source: "version_diff",
        relevance: "contrary",
      });
    }
  }

  for (const change of revisionChanges) {
    snippets.push({
      text: change,
      location: "revision_candidate",
      source: "revision_note",
      relevance: "contrary",
    });
  }

  for (const kw of plan.keyword_queries) {
    const hits = findParagraphsContaining(currentText, kw);
    for (const hit of hits) {
      if (plan.contrary_lexicon.some((w) => hit.toLowerCase().includes(w.toLowerCase()))) {
        snippets.push({
          text: hit,
          location: `contrary_keyword:${kw}`,
          source: "current_manuscript",
          relevance: "contrary",
        });
      }
    }
  }

  return dedupeSnippets(snippets);
}

function findParagraphsContaining(text: string, keyword: string): string[] {
  const lower = keyword.toLowerCase();
  return splitParagraphs(text).filter((p) => p.toLowerCase().includes(lower));
}

function paragraphMatchesIssue(paragraph: string, issue: string): boolean {
  const issueWords = issue
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .slice(0, 5);
  if (issueWords.length === 0) return false;
  const para = paragraph.toLowerCase();
  const hits = issueWords.filter((w) => para.includes(w)).length;
  return hits >= Math.ceil(issueWords.length * 0.4);
}

function paragraphLooksImproved(paragraph: string, plan: SearchPlan): boolean {
  const lower = paragraph.toLowerCase();
  return (
    plan.resolution_lexicon.some((w) => lower.includes(w.toLowerCase())) ||
    plan.contrary_lexicon.some((w) => lower.includes(w.toLowerCase()))
  );
}

function dedupeSnippets(snippets: EvidenceSnippet[]): EvidenceSnippet[] {
  const seen = new Set<string>();
  return snippets.filter((s) => {
    const key = s.text.slice(0, 120);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
