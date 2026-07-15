/** Derive a stable slug from criticism text (generic, no hardcoded concern ids). */

export function slugFromText(text: string, prefix = "concern"): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 6)
    .join("_");
  return base ? `${prefix}_${base}` : `${prefix}_${hashString(text)}`;
}

function hashString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).slice(0, 8);
}

export function dedupeId(base: string, seen: Set<string>): string {
  let id = base;
  let n = 2;
  while (seen.has(id)) {
    id = `${base}_${n}`;
    n++;
  }
  seen.add(id);
  return id;
}
