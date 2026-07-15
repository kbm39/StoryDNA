/**
 * Normalize free-text criticism into stable root-issue keys for duplicate detection.
 * Pattern-based — not manuscript-specific.
 */

export interface RootIssuePattern {
  key: string;
  label: string;
  patterns: RegExp[];
}

export const ROOT_ISSUE_PATTERNS: RootIssuePattern[] = [
  {
    key: "back_third_denouement",
    label: "Back-third / denouement bloat",
    patterns: [
      /\bback\s+third\b/i,
      /\bdenouement\b/i,
      /\bch\.?\s*20/i,
      /\bfalse\s+end/i,
      /\bwind-?down\b/i,
      /\bcelebratory\b/i,
      /\btension-free\b/i,
    ],
  },
  {
    key: "wish_fulfillment",
    label: "Wish-fulfillment / frictionless wins",
    patterns: [
      /\bwish-?fulfill/i,
      /\bfrictionless\b/i,
      /\bunbroken\s+competence\b/i,
      /\buniform\s+(?:ensemble\s+)?competence\b/i,
      /\bdeus-ex\b/i,
      /\boval-?office\b/i,
      /\bpresidential\s+intervention\b/i,
    ],
  },
  {
    key: "cyrus_survival",
    label: "Cyrus / villain survival",
    patterns: [/\bcyrus\b/i, /\bvillain.*surviv/i, /\bfranchise\s+asset\b/i, /\bdeferr?ing\s+payoff\b/i],
  },
  {
    key: "speechifying",
    label: "Diplomatic speechifying",
    patterns: [
      /\bspeechif/i,
      /\bthesis\s+statement\b/i,
      /\bmonologue\b/i,
      /\bdiplomatic\s+(?:scene|dialogue)\b/i,
    ],
  },
  {
    key: "low_cost_stakes",
    label: "Low cost / near-universal survival",
    patterns: [
      /\bnear-?(?:total|universal)\s+surviv/i,
      /\blow\s+cost\b/i,
      /\bbrutal\s+cost\b/i,
      /\bonly\s+two\s+named\b/i,
      /\binsufficient\s+opposition\b/i,
    ],
  },
  {
    key: "institutional_convenience",
    label: "Institutional convenience / heads-of-state",
    patterns: [
      /\bheads-of-state\b/i,
      /\bf-?35\b/i,
      /\btask-?force\s+formal/i,
      /\bwives.*conditions\b/i,
      /\binstitutional\b/i,
    ],
  },
];

export function normalizeRootIssueKey(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "unknown";
  for (const group of ROOT_ISSUE_PATTERNS) {
    if (group.patterns.some((p) => p.test(trimmed))) return group.key;
  }
  return slugRoot(trimmed);
}

export function rootIssueLabel(key: string): string {
  return ROOT_ISSUE_PATTERNS.find((g) => g.key === key)?.label ?? key;
}

function slugRoot(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 6)
    .join("_")
    .slice(0, 64);
}
