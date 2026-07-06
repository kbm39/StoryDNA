import "server-only";
import PptxGenJS from "pptxgenjs";

interface Slide {
  title: string;
  bullets: string[];
}

function stripMd(s: string): string {
  return s
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/^#+\s*/, "")
    .trim();
}

/** Parse deck markdown (one slide per `##` heading) into slides. */
function parseSlides(markdown: string): Slide[] {
  const slides: Slide[] = [];
  let cur: Slide | null = null;
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    const heading = line.match(/^##\s+(.*)$/);
    if (heading) {
      cur = { title: stripMd(heading[1]), bullets: [] };
      slides.push(cur);
      continue;
    }
    if (!cur || !line) continue;
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      cur.bullets.push(stripMd(bullet[1]));
    } else if (!line.startsWith("#")) {
      cur.bullets.push(stripMd(line));
    }
  }
  return slides.filter((s) => s.title || s.bullets.length);
}

const BG = "0B1020";
const ACCENT = "8AB4F8";
const TEXT = "E8E8F0";

export async function buildPitchDeckPptx(markdown: string, deckTitle: string): Promise<Buffer> {
  const slides = parseSlides(markdown);
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
  pptx.layout = "WIDE";
  pptx.author = "Manuscript App";
  pptx.title = deckTitle;

  if (slides.length === 0) {
    const s = pptx.addSlide();
    s.background = { color: BG };
    s.addText(deckTitle, { x: 0.6, y: 3, w: 12.1, h: 1.5, fontSize: 36, bold: true, color: "FFFFFF" });
  }

  for (const slide of slides) {
    const s = pptx.addSlide();
    s.background = { color: BG };
    s.addText(slide.title, {
      x: 0.6,
      y: 0.45,
      w: 12.1,
      h: 1.0,
      fontSize: 30,
      bold: true,
      color: ACCENT,
      fontFace: "Arial",
    });
    if (slide.bullets.length) {
      s.addText(
        slide.bullets.map((b) => ({ text: b, options: { bullet: { indent: 18 }, breakLine: true } })),
        {
          x: 0.8,
          y: 1.9,
          w: 11.7,
          h: 5.1,
          fontSize: 18,
          color: TEXT,
          fontFace: "Arial",
          valign: "top",
          lineSpacingMultiple: 1.15,
          paraSpaceAfter: 8,
        },
      );
    }
  }

  const out = await pptx.write({ outputType: "nodebuffer" });
  return out as Buffer;
}
