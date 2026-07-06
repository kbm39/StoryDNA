import { getPitchDeck } from "@/lib/decks";
import { buildPitchDeckPptx } from "@/lib/pptx";

const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

function safeName(title: string): string {
  return (title || "pitch-deck").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 80);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; deckId: string }> },
) {
  const { deckId } = await params;
  const deck = await getPitchDeck(deckId);
  if (!deck) return new Response("Not found", { status: 404 });

  const title = deck.title || "Pitch Deck";
  const buffer = await buildPitchDeckPptx(deck.content, title);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": PPTX_MIME,
      "Content-Disposition": `attachment; filename="${safeName(title)}_Pitch_Deck.pptx"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
