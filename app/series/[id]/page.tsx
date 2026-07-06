import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getSeries, listSeriesBooks, listSeriesTreatments } from "@/lib/series";
import { listSeriesDecks } from "@/lib/decks";
import SeriesHeader from "./SeriesHeader";
import SeriesBooksManager from "./SeriesBooksManager";
import SeriesTreatmentPanel from "./SeriesTreatmentPanel";
import SeriesTreatmentActions from "./SeriesTreatmentActions";
import PitchDeckPanel from "@/app/components/PitchDeckPanel";
import DeckActions from "@/app/components/DeckActions";

export const dynamic = "force-dynamic";
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

export default async function SeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const series = await getSeries(id);
  if (!series) notFound();

  const [books, treatments, decks] = await Promise.all([
    listSeriesBooks(id),
    listSeriesTreatments(id),
    listSeriesDecks(id),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <Link href="/" className="text-sm text-accent hover:underline">
        ← All manuscripts
      </Link>

      <header className="mt-3 mb-6">
        <SeriesHeader seriesId={id} title={series.title} />
        <p className="mt-1 text-sm text-black/55 dark:text-white/55">
          {books.length} linked {books.length === 1 ? "book" : "books"} · each book becomes a season
        </p>
      </header>

      <section className="scroll-mt-20">
        <h2 className="mb-1 text-xl font-semibold">Books in this series</h2>
        <p className="mb-3 text-sm text-black/55 dark:text-white/55">
          Set the order (Book 1, Book 2…). The cohesive treatment and deck follow this order.
        </p>
        <SeriesBooksManager
          seriesId={id}
          books={books.map((b) => ({ id: b.id, title: b.title, order: b.series_order }))}
        />
      </section>

      <section className="mt-12 scroll-mt-20">
        <h2 className="mb-1 text-xl font-semibold">Series treatment</h2>
        <p className="mb-3 text-sm text-black/55 dark:text-white/55">
          One cohesive, producer-ready treatment spanning every book — overarching premise,
          season-by-season arc, character arcs across the franchise, and the roadmap.
        </p>
        <SeriesTreatmentPanel seriesId={id} />

        {treatments.length > 0 && (
          <div className="mt-5 space-y-5">
            {treatments.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-black/10 bg-paper p-5 shadow-sm dark:border-white/15 dark:bg-white/5"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    Series treatment
                    <span className="font-normal text-black/45 dark:text-white/45">
                      {" "}· {PROVIDER_LABEL[t.provider] ?? t.provider}
                      {t.model ? ` · ${t.model}` : ""} · {fmtDateTime(t.created_at)}
                    </span>
                  </span>
                  <div className="flex items-center gap-3">
                    <a
                      href={`/series/${id}/treatments/${t.id}/download`}
                      className="text-sm font-medium text-accent hover:underline"
                    >
                      Download .docx
                    </a>
                    <SeriesTreatmentActions id={t.id} seriesId={id} />
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

      <section className="mt-12 scroll-mt-20">
        <h2 className="mb-1 text-xl font-semibold">Series pitch deck</h2>
        <p className="mb-3 text-sm text-black/55 dark:text-white/55">
          A franchise pitch deck across all books, exportable to PowerPoint (.pptx).
        </p>
        <PitchDeckPanel scope="series" id={id} />

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
                      href={`/series/${id}/decks/${d.id}/download`}
                      className="text-sm font-medium text-accent hover:underline"
                    >
                      Download .pptx
                    </a>
                    <DeckActions id={d.id} seriesId={id} />
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
    </main>
  );
}
