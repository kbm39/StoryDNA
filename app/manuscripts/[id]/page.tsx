import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getManuscriptMeta, listReviews } from "@/lib/reviews";
import { listConcernAssessmentsForReview } from "@/lib/concern-assessments";
import { activeCommercialReview } from "@/lib/review-selection";
import { listIssues } from "@/lib/issues";
import { listSuggestionsForIssues, groupByIssue } from "@/lib/suggestions";
import { listRevisionChecks } from "@/lib/revisions";
import { listBrainstorms, groupByPrompt } from "@/lib/brainstorms";
import { listTreatments } from "@/lib/treatments";
import { listQueryLetters } from "@/lib/queries";
import { getMarketabilityReport } from "@/lib/marketability";
import {
  getEditorialAnalysis,
  listEditorialComments,
  listAssessmentsForComments,
  listSuggestionsForComments,
  groupAssessmentsByComment,
  groupSuggestionsByComment,
} from "@/lib/editorial";
import { listManuscriptDecks } from "@/lib/decks";
import { listSeries } from "@/lib/series";
import { listDocuments, groupDocuments } from "@/lib/documents";
import { listSubmissions } from "@/lib/submissions";
import { DOC_SPECS, type DocType } from "@/lib/ai/shared";
import type { ManuscriptDocument } from "@/lib/types";
import { listAgentOptions, type AgentOption } from "@/lib/agentfinder";
import { TREATMENT_FORMAT_LABEL, type TreatmentFormat } from "@/lib/ai/shared";
import type {
  Review,
  RevisionCheck,
  ReviewMeta,
  ReviewConcernAssessment,
  ComplianceItemStatus,
  ConstitutionalStatus,
} from "@/lib/types";
import GenerateReviewsButton from "./GenerateReviewsButton";
import RunAgentReviewButton from "./RunAgentReviewButton";
import RevisionCandidatesPreview from "./RevisionCandidatesPreview";
import { ReviewGradingPanel } from "./ReviewGradingPanel";
import { RevisionImpactPanel } from "./RevisionImpactPanel";
import { memoContentForDisplay } from "@/lib/review-display";
import { ManuscriptWordCountReport } from "./ManuscriptWordCountReport";
import { getEditorialIssues, getRevisionCandidates } from "@/lib/agent-revisions";
import { getRevisionGenerationStatus } from "@/app/actions/agent-revisions";
import ExtractIssuesButton from "./ExtractIssuesButton";
import AddIssueForm from "./AddIssueForm";
import IssueItem from "./IssueItem";
import RevisionPanel from "./RevisionPanel";
import GradeLegend from "./GradeLegend";
import ScreenReviewButton from "./ScreenReviewButton";
import TreatmentPanel from "./TreatmentPanel";
import TreatmentActions from "./TreatmentActions";
import QueryLetterPanel from "./QueryLetterPanel";
import QueryLetterActions from "./QueryLetterActions";
import MarketabilityPanel from "./MarketabilityPanel";
import SeriesAssignPanel from "./SeriesAssignPanel";
import SubmissionTracker from "./SubmissionTracker";
import PitchDeckPanel from "@/app/components/PitchDeckPanel";
import DeckActions from "@/app/components/DeckActions";
import DocumentPanel from "@/app/components/DocumentPanel";
import DocumentActions from "@/app/components/DocumentActions";
import BrainstormForm from "./BrainstormForm";
import BrainstormActions from "./BrainstormActions";
import EditorialPanel from "./EditorialPanel";
import CommentItem from "./CommentItem";

export const dynamic = "force-dynamic";
// AI generation (reviews, re-check, suggestions) can run for minutes. On Vercel
// this needs a plan that allows a long function duration (Pro → up to 300s).
export const maxDuration = 300;

const PROVIDER_LABEL: Record<string, string> = { openai: "OpenAI", anthropic: "Claude" };

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function DocSection({
  navId,
  docType,
  manuscriptId,
  docs,
  verb = "Generate",
}: {
  navId: string;
  docType: DocType;
  manuscriptId: string;
  docs: ManuscriptDocument[];
  verb?: string;
}) {
  const spec = DOC_SPECS[docType];
  return (
    <section id={navId} className="mt-12 scroll-mt-20">
      <h2 className="mb-1 text-xl font-semibold">{spec.label}</h2>
      <p className="mb-3 text-sm text-black/55 dark:text-white/55">{spec.blurb}</p>
      <DocumentPanel manuscriptId={manuscriptId} docType={docType} verb={verb} />
      {docs.length > 0 && (
        <div className="mt-5 space-y-5">
          {docs.map((d) => (
            <div
              key={d.id}
              className="rounded-xl border border-black/10 bg-paper p-5 shadow-sm dark:border-white/15 dark:bg-white/5"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {spec.label}
                  <span className="font-normal text-black/45 dark:text-white/45">
                    {" "}· {PROVIDER_LABEL[d.provider] ?? d.provider}
                    {d.model ? ` · ${d.model}` : ""} · {fmtDateTime(d.created_at)}
                  </span>
                </span>
                <div className="flex items-center gap-3">
                  <a
                    href={`/manuscripts/${manuscriptId}/documents/${d.id}/download`}
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    Download .docx
                  </a>
                  <DocumentActions id={d.id} manuscriptId={manuscriptId} />
                </div>
              </div>
              <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold">
                <ReactMarkdown>{d.content}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const STATUS_STYLE: Record<ConstitutionalStatus, { label: string; cls: string }> = {
  compliant: { label: "Compliant", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" },
  partially_compliant: { label: "Partially compliant", cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200" },
  not_compliant: { label: "Not compliant", cls: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" },
};

function MetaRow({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="inline text-black/45 dark:text-white/45">{k}: </dt>
      <dd className="inline font-medium text-black/70 dark:text-white/70">{v}</dd>
    </div>
  );
}

const COMPLIANCE_ICON: Record<ComplianceItemStatus, { icon: string; cls: string }> = {
  met: { icon: "✓", cls: "text-emerald-600 dark:text-emerald-400" },
  partial: { icon: "◑", cls: "text-amber-600 dark:text-amber-400" },
  unmet: { icon: "○", cls: "text-black/30 dark:text-white/30" },
};

/** Review Transparency header — honest disclosure of what review was performed. */
function TransparencyHeader({ meta }: { meta: ReviewMeta }) {
  const s = STATUS_STYLE[meta.compliance.status];
  return (
    <div className="mb-4 rounded-lg border border-black/10 bg-black/[.02] p-3 text-xs dark:border-white/10 dark:bg-white/[.03]">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-sans font-semibold uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
          Review Transparency
        </span>
        <span className={`rounded-full px-2 py-0.5 font-semibold ${s.cls}`}>
          {s.label} · {meta.compliance.score}%
        </span>
      </div>
      <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-black/35 dark:text-white/35">
        Reviewed under StoryDNA Constitution v{meta.constitution_version}
      </p>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        <MetaRow k="Reviewer" v={meta.reviewer} />
        <MetaRow k="Perspective" v={meta.perspective} />
        <MetaRow k="Scope" v={meta.scope} />
        <MetaRow k="Depth" v={meta.depth} />
        <MetaRow
          k="Coverage"
          v={`${meta.coverage.words_analyzed.toLocaleString()} words · ${meta.coverage.percent}%`}
        />
        <MetaRow k="Basis" v={meta.coverage.basis} />
        <MetaRow k="Model" v={meta.model} />
        <MetaRow
          k="Author intent"
          v={meta.author_intent_applied ? meta.author_intent_source : "Not applied"}
        />
        <MetaRow k="Evidence present" v={meta.evidence_present ? "Yes" : "No"} />
        <MetaRow k="Machine-verified" v={meta.evidence_machine_verified ? "Yes" : "Not yet"} />
      </dl>

      <div className="mt-3 border-t border-black/10 pt-2 dark:border-white/10">
        <p className="mb-1 font-sans font-semibold uppercase tracking-[0.12em] text-black/45 dark:text-white/45">
          Constitutional Compliance
        </p>
        <ul className="space-y-0.5">
          {meta.compliance.items.map((it) => {
            const ic = COMPLIANCE_ICON[it.status];
            return (
              <li key={it.requirement} className="flex gap-1.5">
                <span className={`shrink-0 ${ic.cls}`}>{ic.icon}</span>
                <span className="text-black/70 dark:text-white/70">
                  {it.requirement}
                  {it.note && (
                    <span className="text-black/40 dark:text-white/40"> — {it.note}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mt-2 text-[11px] italic leading-snug text-black/45 dark:text-white/45">
        {meta.compliance.summary}
      </p>
    </div>
  );
}

function ReviewColumn({
  heading,
  subheading,
  accent,
  review,
  manuscriptId,
  concernAssessments,
  priorScore,
}: {
  heading: string;
  subheading: string;
  accent: string;
  review: Review | undefined;
  manuscriptId: string;
  concernAssessments?: ReviewConcernAssessment[];
  priorScore?: number | null;
}) {
  const rawMeta = review?.metadata?.review_meta as ReviewMeta | undefined;
  const meta = rawMeta?.compliance ? rawMeta : undefined;
  const truncated = Boolean(review?.metadata?.truncated);
  const displayContent = review ? memoContentForDisplay(review.content) : "";
  const showGrading = review?.perspective === "commercial";
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-black/10 bg-paper shadow-sm dark:border-white/15 dark:bg-white/5">
      <div className="flex items-start justify-between gap-2 border-b border-black/10 px-5 py-3 dark:border-white/10">
        <div className="min-w-0">
          <h3 className={`font-serif text-base font-semibold ${accent}`}>{heading}</h3>
          <p className="text-xs text-black/50 dark:text-white/50">
            {subheading}
            {review?.model ? ` · ${review.model}` : ""}
            {review?.created_at ? ` · ${fmtDateTime(review.created_at)}` : ""}
          </p>
        </div>
        {review && (
          <a
            href={`/manuscripts/${manuscriptId}/reviews/${review.id}/download`}
            className="shrink-0 text-xs font-medium text-accent hover:underline"
          >
            Download .docx
          </a>
        )}
      </div>
      <div className="px-5 py-4">
        {review ? (
          <>
            {showGrading && <ReviewGradingPanel review={review} assessments={concernAssessments} />}
            {showGrading && concernAssessments && (
              <RevisionImpactPanel
                review={review}
                assessments={concernAssessments}
                priorScore={priorScore}
              />
            )}
            {meta ? (
              <TransparencyHeader meta={meta} />
            ) : (
              truncated && (
                <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                  Based on a truncated portion of the manuscript (it exceeded the model’s
                  context limit).
                </p>
              )
            )}
            <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold">
              <ReactMarkdown>{displayContent}</ReactMarkdown>
            </div>
          </>
        ) : (
          <p className="text-sm text-black/50 dark:text-white/50">
            Not generated yet.
          </p>
        )}
      </div>
    </div>
  );
}

export default async function ManuscriptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const manuscript = await getManuscriptMeta(id);
  if (!manuscript) notFound();

  const [reviews, issues] = await Promise.all([listReviews(id), listIssues(id)]);
  const [
    suggestions,
    revisionChecks,
    brainstorms,
    treatments,
    queryLetters,
    marketability,
    decks,
    allSeries,
    documents,
    submissions,
  ] = await Promise.all([
    listSuggestionsForIssues(issues.map((i) => i.id)),
    listRevisionChecks(id),
    listBrainstorms(id),
    listTreatments(id),
    listQueryLetters(id),
    getMarketabilityReport(id),
    listManuscriptDecks(id),
    listSeries(),
    listDocuments(id),
    listSubmissions(id),
  ]);
  const editorialAnalysis = await getEditorialAnalysis(id);
  const editorialComments = editorialAnalysis
    ? await listEditorialComments(editorialAnalysis.id)
    : [];
  const commentIds = editorialComments.map((c) => c.id);
  const [commentAssessments, commentSuggestions] = await Promise.all([
    listAssessmentsForComments(commentIds),
    listSuggestionsForComments(commentIds),
  ]);
  const assessmentsByComment = groupAssessmentsByComment(commentAssessments);
  const commentSuggestionsByComment = groupSuggestionsByComment(commentSuggestions);
  const currentSeries = manuscript.series_id
    ? allSeries.find((s) => s.id === manuscript.series_id) ?? null
    : null;
  const [editorialIssues, revisionCandidates, revisionGenStatus] = await Promise.all([
    getEditorialIssues(id),
    getRevisionCandidates(id),
    getRevisionGenerationStatus(id),
  ]);
  const groupedDocs = groupDocuments(documents);
  // External PKagentfinder DB — never let it break the page.
  let agents: AgentOption[] = [];
  try {
    agents = await listAgentOptions();
  } catch {
    agents = [];
  }
  const brainstormRounds = groupByPrompt(brainstorms);
  const suggestionsByIssue = groupByIssue(suggestions);
  const commercial = activeCommercialReview(reviews);
  const craft = reviews.find((r) => r.perspective === "craft");
  const concernAssessments = commercial
    ? await listConcernAssessmentsForReview(commercial.id)
    : [];
  const priorCommercialScore =
    (commercial?.grading_metadata as { prior_manuscript_score?: number } | null)
      ?.prior_manuscript_score ??
    reviews.find(
      (r) => r.perspective === "commercial" && r.lifecycle_status === "superseded",
    )?.manuscript_score ??
    null;
  const screenReviews = reviews.filter((r) => r.perspective === "screen");
  const outstandingIssues = issues
    .filter((i) => i.status === "outstanding")
    .map((i) => ({ id: i.id, title: i.title }));
  const outstandingCount = outstandingIssues.length;
  const latestCheck = revisionChecks[0];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="text-sm text-accent hover:underline">
          ← All manuscripts
        </Link>
        <Link
          href={`/storydna/${id}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-sm font-semibold text-accent transition hover:bg-accent/10"
        >
          ✦ StoryDNA
        </Link>
      </div>

      <header className="mt-3 mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{manuscript.title}</h1>
          <p className="mt-1 text-sm text-black/55 dark:text-white/55">
            {manuscript.original_filename}
          </p>
          <ManuscriptWordCountReport
            canonicalWordCount={manuscript.word_count}
            sourceDocumentWordCount={manuscript.source_document_word_count}
          />
          <p className="mt-0.5 text-xs text-black/45 dark:text-white/45">
            Uploaded {fmtDateTime(manuscript.created_at)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <a
            href={`/manuscripts/${id}/download`}
            className="text-sm font-medium text-accent hover:underline"
          >
            Download .docx
          </a>
          <GenerateReviewsButton
            manuscriptId={id}
            hasCommercial={Boolean(commercial)}
            hasCraft={Boolean(craft)}
          />
        </div>
      </header>

      <nav className="mb-8 flex flex-wrap gap-1 border-y border-black/10 py-2 text-sm dark:border-white/10">
        {[
          ["Reviews", "#reviews"],
          ["Producer’s read", "#screen"],
          ["Treatment", "#treatment"],
          ["Marketability", "#marketability"],
          ["Pitch deck", "#deck"],
          ["Series", "#series"],
          ["Synopsis", "#synopsis"],
          ["Opening", "#opening"],
          ["Line edit", "#linedit"],
          ["Continuity", "#continuity"],
          ["Marketing", "#marketing"],
          ["Query letters", "#query"],
          ["Submissions", "#submissions"],
          ["Editorial analysis", "#editorial"],
          ["Issues", "#issues"],
          ["Revisions & score", "#revisions"],
          ["Brainstorm", "#brainstorm"],
        ].map(([label, href]) => (
          <a
            key={href}
            href={href}
            className="rounded-full px-3 py-1 text-black/60 hover:bg-accent/10 hover:text-accent dark:text-white/60"
          >
            {label}
          </a>
        ))}
      </nav>

      <section id="reviews" className="scroll-mt-20">
        <RunAgentReviewButton
          manuscriptId={id}
          hasReview={Boolean(commercial)}
          generationStatus={revisionGenStatus}
        />
        {(commercial || craft) && (
          <div className="mb-3 flex justify-end">
            <a
              href={`/manuscripts/${id}/export-reviews`}
              className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:border-accent/40 hover:text-accent dark:border-white/20"
            >
              Export reviews to Word
            </a>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <ReviewColumn
            heading="Literary Agent · Acquisitions Memo"
            subheading="Commercial Acquisitions"
            accent="text-emerald-700 dark:text-emerald-400"
            review={commercial}
            manuscriptId={id}
            concernAssessments={concernAssessments}
            priorScore={priorCommercialScore}
          />
          <ReviewColumn
            heading="Developmental edit"
            subheading="Claude · craft"
            accent="text-indigo-700 dark:text-indigo-400"
            review={craft}
            manuscriptId={id}
          />
        </div>

        {(commercial || craft) && (
          <div className="mt-4">
            <GradeLegend />
          </div>
        )}

        {editorialIssues.length > 0 && (
          <RevisionCandidatesPreview
            issues={editorialIssues}
            candidates={revisionCandidates}
            manuscriptId={id}
          />
        )}
      </section>

      <section id="screen" className="mt-12 scroll-mt-20">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Producer’s read · TV / film</h2>
            <p className="text-sm text-black/55 dark:text-white/55">
              How this reads to a producer weighing a screen adaptation.
            </p>
          </div>
          <ScreenReviewButton
            manuscriptId={id}
            hasOpenAI={screenReviews.some((r) => r.provider === "openai")}
            hasClaude={screenReviews.some((r) => r.provider === "anthropic")}
          />
        </div>
        {screenReviews.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2">
            {screenReviews.map((r) => (
              <ReviewColumn
                key={r.id}
                heading="Producer’s read"
                subheading={`${PROVIDER_LABEL[r.provider] ?? r.provider} · screen`}
                accent="text-amber-700 dark:text-amber-400"
                review={r}
                manuscriptId={id}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-black/55 dark:text-white/55">
            No producer’s read yet — generate one above.
          </p>
        )}
      </section>

      <section id="treatment" className="mt-12 scroll-mt-20">
        <h2 className="mb-1 text-xl font-semibold">Treatment</h2>
        <p className="mb-3 text-sm text-black/55 dark:text-white/55">
          Build a comprehensive, producer-ready treatment (series-bible depth) from the manuscript —
          led by a one-page Producer Summary, then logline, world, themes, a character bible, a
          full episode guide, future seasons, and commercial viability.
        </p>
        <TreatmentPanel manuscriptId={id} />

        {treatments.length > 0 && (
          <div className="mt-5 space-y-5">
            {treatments.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-black/10 bg-paper p-5 shadow-sm dark:border-white/15 dark:bg-white/5"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {TREATMENT_FORMAT_LABEL[t.format as TreatmentFormat] ?? t.format}
                    <span className="font-normal text-black/45 dark:text-white/45">
                      {" "}· {PROVIDER_LABEL[t.provider] ?? t.provider}
                      {t.model ? ` · ${t.model}` : ""} · {fmtDateTime(t.created_at)}
                    </span>
                  </span>
                  <div className="flex items-center gap-3">
                    <a
                      href={`/manuscripts/${id}/treatments/${t.id}/download`}
                      className="text-sm font-medium text-accent hover:underline"
                    >
                      Download .docx
                    </a>
                    <TreatmentActions id={t.id} manuscriptId={id} />
                  </div>
                </div>
                <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold">
                  <ReactMarkdown>{t.content}</ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="marketability" className="mt-12 scroll-mt-20">
        <h2 className="mb-1 text-xl font-semibold">Marketability</h2>
        <p className="mb-3 text-sm text-black/55 dark:text-white/55">
          Upload your marketability report — the AI distills its key components and key issues, and
          those positioning cues feed into your query letters, pitch deck, and marketing copy.
        </p>
        <MarketabilityPanel
          manuscriptId={id}
          hasReport={Boolean(marketability)}
          fileName={marketability?.file_name ?? null}
          hasSummary={Boolean(marketability?.summary)}
          uploadedAt={marketability?.created_at ?? null}
        />

        {marketability?.summary && (
          <div className="mt-5 rounded-xl border border-black/10 bg-paper p-5 shadow-sm dark:border-white/15 dark:bg-white/5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">
                Report summary
                <span className="font-normal text-black/45 dark:text-white/45">
                  {marketability.provider
                    ? ` · ${PROVIDER_LABEL[marketability.provider] ?? marketability.provider}`
                    : ""}
                  {marketability.model ? ` · ${marketability.model}` : ""} ·{" "}
                  {fmtDateTime(marketability.updated_at)}
                </span>
              </span>
              <a
                href={`/manuscripts/${id}/marketability/download`}
                className="text-sm font-medium text-accent hover:underline"
              >
                Download .docx
              </a>
            </div>
            <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold">
              <ReactMarkdown>{marketability.summary}</ReactMarkdown>
            </div>
          </div>
        )}
      </section>

      <section id="deck" className="mt-12 scroll-mt-20">
        <h2 className="mb-1 text-xl font-semibold">Pitch deck</h2>
        <p className="mb-3 text-sm text-black/55 dark:text-white/55">
          A slide-based pitch deck for this book, exportable to PowerPoint (.pptx). Generate a
          treatment first for the richest deck.
          {marketability ? " Your marketability report’s positioning and comps are woven in." : ""}
        </p>
        <PitchDeckPanel scope="manuscript" id={id} />

        {decks.length > 0 && (
          <div className="mt-5 space-y-5">
            {decks.map((d) => (
              <div
                key={d.id}
                className="rounded-xl border border-black/10 bg-paper p-5 shadow-sm dark:border-white/15 dark:bg-white/5"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    Pitch deck
                    <span className="font-normal text-black/45 dark:text-white/45">
                      {" "}· {PROVIDER_LABEL[d.provider] ?? d.provider}
                      {d.model ? ` · ${d.model}` : ""} · {fmtDateTime(d.created_at)}
                    </span>
                  </span>
                  <div className="flex items-center gap-3">
                    <a
                      href={`/manuscripts/${id}/decks/${d.id}/download`}
                      className="text-sm font-medium text-accent hover:underline"
                    >
                      Download .pptx
                    </a>
                    <DeckActions id={d.id} manuscriptId={id} />
                  </div>
                </div>
                <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-h2:text-base prose-h2:mt-4">
                  <ReactMarkdown>{d.content}</ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="series" className="mt-12 scroll-mt-20">
        <h2 className="mb-1 text-xl font-semibold">Series</h2>
        <p className="mb-3 text-sm text-black/55 dark:text-white/55">
          Link this book with others in the same series to build a cohesive, cross-book treatment and
          franchise pitch deck.
        </p>
        <SeriesAssignPanel
          manuscriptId={id}
          currentSeriesId={manuscript.series_id}
          currentSeriesTitle={currentSeries?.title ?? null}
          currentOrder={manuscript.series_order}
          allSeries={allSeries.map((s) => ({ id: s.id, title: s.title }))}
        />
      </section>

      <DocSection navId="synopsis" docType="synopsis" manuscriptId={id} docs={groupedDocs.synopsis} />
      <DocSection
        navId="opening"
        docType="opening_critique"
        manuscriptId={id}
        docs={groupedDocs.opening_critique}
        verb="Critique"
      />
      <DocSection
        navId="linedit"
        docType="line_edit"
        manuscriptId={id}
        docs={groupedDocs.line_edit}
        verb="Run"
      />
      <DocSection
        navId="continuity"
        docType="continuity"
        manuscriptId={id}
        docs={groupedDocs.continuity}
        verb="Build"
      />
      <DocSection navId="marketing" docType="marketing" manuscriptId={id} docs={groupedDocs.marketing} />

      <section id="query" className="mt-12 scroll-mt-20">
        <h2 className="mb-1 text-xl font-semibold">Query letters</h2>
        <p className="mb-3 text-sm text-black/55 dark:text-white/55">
          Generate a query tailored to an agent pulled from PKagentfinder.
          {marketability?.summary
            ? " Your marketability report’s positioning, comps, and key issues are woven in."
            : ""}
        </p>
        <QueryLetterPanel manuscriptId={id} agents={agents} />

        {queryLetters.length > 0 && (
          <div className="mt-5 space-y-5">
            {queryLetters.map((q) => (
              <div
                key={q.id}
                className="rounded-xl border border-black/10 bg-paper p-5 shadow-sm dark:border-white/15 dark:bg-white/5"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {q.agent_name ?? "Agent"}
                    {q.agency ? ` · ${q.agency}` : ""}
                    <span className="font-normal text-black/45 dark:text-white/45">
                      {" "}· {PROVIDER_LABEL[q.provider] ?? q.provider} · {fmtDateTime(q.created_at)}
                    </span>
                  </span>
                  <div className="flex items-center gap-3">
                    <a
                      href={`/manuscripts/${id}/queries/${q.id}/download`}
                      className="text-sm font-medium text-accent hover:underline"
                    >
                      Download .docx
                    </a>
                    <QueryLetterActions id={q.id} manuscriptId={id} />
                  </div>
                </div>
                <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-p:my-1.5">
                  <ReactMarkdown>{q.content}</ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="submissions" className="mt-12 scroll-mt-20">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Submissions</h2>
            <p className="text-sm text-black/55 dark:text-white/55">
              Track which agents you’ve queried and where each stands.
            </p>
          </div>
          <a
            href={`/manuscripts/${id}/format/download`}
            className="text-sm font-medium text-accent hover:underline"
          >
            Download manuscript-format .docx
          </a>
        </div>
        <SubmissionTracker manuscriptId={id} agents={agents} submissions={submissions} />
      </section>

      <section id="editorial" className="mt-12 scroll-mt-20">
        <div className="mb-1 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold">Editorial analysis</h2>
          {editorialComments.length > 0 && (
            <a
              href={`/manuscripts/${id}/editorial/download`}
              className="text-sm font-medium text-accent hover:underline"
            >
              Download .docx
            </a>
          )}
        </div>
        <p className="mb-3 text-sm text-black/55 dark:text-white/55">
          Upload an editor’s analysis. It’s split into individual comments, and OpenAI and Claude
          each say whether they agree or disagree with every one. For any comment you can request
          fixes, edit them, then either apply them as text edits or drop them into your .docx as a
          Word margin comment.
        </p>
        <EditorialPanel
          manuscriptId={id}
          hasAnalysis={Boolean(editorialAnalysis)}
          fileName={editorialAnalysis?.file_name ?? null}
          uploadedAt={editorialAnalysis?.created_at ?? null}
          hasComments={editorialComments.length > 0}
        />

        {editorialComments.length > 0 && (
          <ul className="mt-5 divide-y divide-black/10 overflow-hidden rounded-lg border border-black/10 bg-paper dark:divide-white/10 dark:border-white/15 dark:bg-white/5">
            {editorialComments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                assessments={assessmentsByComment.get(c.id) ?? []}
                suggestions={commentSuggestionsByComment.get(c.id) ?? []}
                manuscriptId={id}
              />
            ))}
          </ul>
        )}
      </section>

      <section id="issues" className="mt-12 scroll-mt-20">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Issues checklist</h2>
            <p className="text-sm text-black/60 dark:text-white/60">
              {issues.length === 0
                ? "No issues yet."
                : `${outstandingCount} outstanding · ${issues.length - outstandingCount} resolved`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {issues.length > 0 && (
              <a
                href={`/manuscripts/${id}/export-issues`}
                className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/10"
              >
                Export to Word
              </a>
            )}
            <ExtractIssuesButton manuscriptId={id} />
          </div>
        </div>

        {issues.length > 0 && (
          <ul className="mb-4 divide-y divide-black/10 overflow-hidden rounded-lg border border-black/10 bg-paper dark:divide-white/10 dark:border-white/15 dark:bg-white/5">
            {issues.map((issue) => (
              <IssueItem
                key={issue.id}
                issue={issue}
                suggestions={suggestionsByIssue.get(issue.id) ?? []}
                manuscriptId={id}
              />
            ))}
          </ul>
        )}

        <AddIssueForm manuscriptId={id} />
      </section>

      <section id="revisions" className="mt-12 scroll-mt-20">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold">Revisions &amp; score</h2>
          {revisionChecks.length > 0 && (
            <a
              href={`/manuscripts/${id}/revisions/download`}
              className="text-sm font-medium text-accent hover:underline"
            >
              Download .docx
            </a>
          )}
        </div>
        <RevisionPanel manuscriptId={id} outstandingIssues={outstandingIssues} />

        {latestCheck && (
          <div className="mt-4 rounded-lg border border-black/10 bg-paper p-5 dark:border-white/15 dark:bg-white/5">
            <div className="flex items-start gap-4">
              {latestCheck.grade && (
                <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-accent font-serif text-3xl font-bold text-white shadow-sm">
                  {latestCheck.grade}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  Latest re-check · {PROVIDER_LABEL[latestCheck.provider] ?? latestCheck.provider}
                  {latestCheck.model ? ` · ${latestCheck.model}` : ""}
                </p>
                <p className="text-xs text-black/50 dark:text-white/50">
                  {fmtDateTime(latestCheck.created_at)} · {latestCheck.resolved_count} resolved ·{" "}
                  {latestCheck.outstanding_count} still outstanding
                </p>
                {latestCheck.summary && (
                  <p className="mt-2 text-sm text-black/70 dark:text-white/70">{latestCheck.summary}</p>
                )}
              </div>
            </div>

            {latestCheck.issue_verdicts && latestCheck.issue_verdicts.length > 0 && (
              <ul className="mt-4 space-y-1.5 border-t border-black/10 pt-3 text-sm dark:border-white/10">
                {latestCheck.issue_verdicts.map((v) => (
                  <li key={v.id} className="flex items-start gap-2">
                    <span className={v.status === "resolved" ? "text-green-600" : "text-amber-600"}>
                      {v.status === "resolved" ? "✓" : "○"}
                    </span>
                    <span className="min-w-0">
                      {v.title && <span className="font-medium">{v.title}. </span>}
                      <span className="text-black/60 dark:text-white/60">{v.note}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {revisionChecks.length > 1 && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-black/45 dark:text-white/45">
              Grade history
            </p>
            <ul className="flex flex-wrap gap-2 text-xs">
              {revisionChecks.map((c: RevisionCheck) => (
                <li key={c.id} className="rounded border border-black/10 px-2 py-1 dark:border-white/15">
                  <span className="font-semibold">{c.grade ?? "—"}</span>
                  <span className="text-black/45 dark:text-white/45">
                    {" "}
                    · {PROVIDER_LABEL[c.provider] ?? c.provider} · {fmtDateTime(c.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section id="brainstorm" className="mt-12 scroll-mt-20">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold">Scene brainstorming</h2>
          {brainstormRounds.length > 0 && (
            <a
              href={`/manuscripts/${id}/brainstorm/download`}
              className="text-sm font-medium text-accent hover:underline"
            >
              Download .docx
            </a>
          )}
        </div>
        <BrainstormForm manuscriptId={id} />

        {brainstormRounds.length > 0 && (
          <div className="mt-5 space-y-6">
            {brainstormRounds.map((round) => (
              <div key={round.prompt}>
                <p className="mb-2 text-sm">
                  <span className="text-black/50 dark:text-white/50">Prompt: </span>
                  <span className="italic">{round.prompt}</span>
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  {round.items.map((b) => (
                    <div
                      key={b.id}
                      className={`rounded-lg border p-4 ${
                        b.selected
                          ? "border-amber-400 bg-amber-50/40 dark:border-amber-500/40 dark:bg-amber-500/5"
                          : "border-black/10 bg-paper dark:border-white/15 dark:bg-white/5"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">
                          {PROVIDER_LABEL[b.provider] ?? b.provider}
                          {b.model ? ` · ${b.model}` : ""}
                        </span>
                        <BrainstormActions id={b.id} manuscriptId={id} selected={b.selected} />
                      </div>
                      <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-p:my-1.5">
                        <ReactMarkdown>{b.content}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
