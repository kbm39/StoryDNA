/** Strip structured rubric JSON from memo display. */
export function memoContentForDisplay(content: string): string {
  const marker = "<!-- STORYDNA_RUBRIC_JSON -->";
  const idx = content.indexOf(marker);
  return idx === -1 ? content : content.slice(0, idx).trim();
}
