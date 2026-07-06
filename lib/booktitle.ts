// Turn a manuscript's metadata + filename into a human title block:
//   Justice Through His Eyes   (series — metadata only)
//   Book 2                     (series order, else inferred from filename)
//   Price of Redemption        (book title — clean metadata, else inferred)
//   Revised Draft              (draft status — inferred from filename)
// Metadata is preferred; anything missing is inferred from the filename.

export interface BookDisplay {
  seriesName: string | null;
  bookLabel: string | null;
  bookTitle: string;
  draftLabel: string | null;
}

const DRAFT_WORDS = [
  "revised",
  "final",
  "first",
  "second",
  "third",
  "rough",
  "clean",
  "polished",
  "working",
  "proof",
  "draft",
];

function tidy(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function titleCaseIfFlat(s: string): string {
  // Only re-case strings that are all-lower or all-upper; leave mixed case alone.
  if (s === s.toLowerCase() || s === s.toUpperCase()) {
    return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  }
  return s;
}

export function parseBookDisplay(
  filename: string,
  title: string | null,
  seriesTitle: string | null,
  seriesOrder: number | null,
): BookDisplay {
  const base = (filename || title || "Untitled").replace(/\.(docx|doc|pdf|txt|md)$/i, "");
  const spaced = tidy(base.replace(/_+/g, " "));

  // Book number: metadata first, then a "Book N" in the filename.
  let bookNum: number | null = seriesOrder ?? null;
  if (bookNum == null) {
    const m = spaced.match(/\bBook\s*(\d+)\b/i);
    if (m) bookNum = parseInt(m[1], 10);
  }

  // Draft status from the filename.
  let draftLabel: string | null = null;
  const draftRe = new RegExp(`\\b(${DRAFT_WORDS.join("|")})\\b`, "i");
  const dm = spaced.match(draftRe);
  if (dm) {
    const w = dm[1].toLowerCase();
    draftLabel = w === "draft" ? "Draft" : `${w[0].toUpperCase()}${w.slice(1)} Draft`;
  }

  // Prefer a human-entered metadata title (no underscores, not just the filename).
  let bookTitle: string;
  const cleanMeta =
    title && !/_/.test(title) && title.trim() && title.trim().toLowerCase() !== base.toLowerCase()
      ? tidy(title)
      : null;

  if (cleanMeta) {
    bookTitle = cleanMeta.replace(/^(the|a|an)\s+/i, "");
  } else {
    let t = spaced;
    t = t.replace(/\bBook\s*\d+\b/gi, " "); // drop "Book N"
    t = t.replace(new RegExp(`\\b(${DRAFT_WORDS.join("|")})\\b`, "gi"), " "); // drop draft words
    t = t.replace(/\b\d+\b/g, " "); // drop stray version numbers
    t = t.replace(/[-–—]+/g, " ");
    t = tidy(t).replace(/^(the|a|an)\s+/i, ""); // drop a leading article
    bookTitle = titleCaseIfFlat(t) || spaced || "Untitled";
  }

  return {
    seriesName: seriesTitle ? tidy(seriesTitle) : null,
    bookLabel: bookNum != null ? `Book ${bookNum}` : null,
    bookTitle,
    draftLabel,
  };
}
