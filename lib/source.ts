import "server-only";
import { listTreatments } from "@/lib/treatments";
import { getManuscriptText, listReviews } from "@/lib/reviews";
import { getSeries, listSeriesBooks } from "@/lib/series";
import { clampManuscript } from "@/lib/ai/shared";

const SERIES_BOOK_FALLBACK_CHARS = 60_000;

/** Best available source describing one book for a deck: its latest treatment
 *  (full-arc, preferred), else the FULL manuscript text. The provider handles
 *  sizing — Claude reads it whole, OpenAI covers it via map-reduce — so the
 *  deck is grounded in the entire book, not an excerpt. Null if nothing usable. */
export async function bookSource(manuscriptId: string): Promise<string | null> {
  const treatments = await listTreatments(manuscriptId);
  if (treatments[0]?.content?.trim()) return treatments[0].content;
  const text = await getManuscriptText(manuscriptId);
  if (text && text.trim()) return text;
  return null;
}

export interface SeriesSource {
  seriesTitle: string;
  bookCount: number;
  source: string;
}

/** Assemble a cohesive, in-order source for a whole series. Prefers each book's
 *  latest treatment, falling back to its commercial review, then a manuscript
 *  excerpt — so series generation scales without sending full novels. */
export async function seriesSource(seriesId: string): Promise<SeriesSource | null> {
  const [series, books] = await Promise.all([getSeries(seriesId), listSeriesBooks(seriesId)]);
  if (!series || books.length === 0) return null;

  const parts: string[] = [];
  let n = 0;
  for (const b of books) {
    n++;
    const treatments = await listTreatments(b.id);
    let body: string = treatments[0]?.content?.trim() ?? "";
    if (!body) {
      const reviews = await listReviews(b.id);
      body = reviews.find((r) => r.perspective === "commercial")?.content?.trim() ?? "";
    }
    if (!body) {
      const text = await getManuscriptText(b.id);
      body = text
        ? `(No treatment yet — manuscript excerpt follows.)\n${clampManuscript(text, SERIES_BOOK_FALLBACK_CHARS).text}`
        : "(No content available for this book.)";
    }
    parts.push(`=== BOOK ${n}: ${b.title} ===\n${body}`);
  }

  return { seriesTitle: series.title, bookCount: books.length, source: parts.join("\n\n") };
}
