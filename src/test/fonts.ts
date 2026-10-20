import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFontLoader } from '../lib/export/fontdata';

/** Reads the bundled font files straight from node_modules, as the browser would fetch them. */
export function useNodeFonts(): void {
  setFontLoader(async (url) => {
    const m = url.match(/(@fontsource\/[^?]*)/);
    if (!m) throw new Error(`unexpected font url ${url}`);
    const file = readFileSync(join(process.cwd(), 'node_modules', m[1]));
    return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  });
}
