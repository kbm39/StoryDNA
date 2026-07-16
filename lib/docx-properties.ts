import JSZip from "jszip";

const WORDS_TAG = /<(?:\w+:)?Words>(\d+)<\/(?:\w+:)?Words>/;

/** Read Microsoft Word embedded document statistics from docProps/app.xml. */
export async function readDocxSourceWordCount(
  input: Buffer | ArrayBuffer | Uint8Array,
): Promise<number | null> {
  const buf =
    input instanceof Buffer
      ? input
      : input instanceof Uint8Array
        ? Buffer.from(input)
        : Buffer.from(new Uint8Array(input));
  const zip = await JSZip.loadAsync(buf);
  const app = zip.file("docProps/app.xml");
  if (!app) return null;
  const xml = await app.async("string");
  const match = xml.match(WORDS_TAG);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}
