import { displayTitle } from '../domain/piece';
import type { Piece } from '../domain/types';
import { crc32 } from './zip';

export const APP_NAME = 'Tonartenverlauf';
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export interface Stamp {
  app: string;
  version: string;
  /** ISO timestamp of the export. */
  exported: string;
  title: string;
  composer: string;
  source: string;
  analyst: string;
  analysisDate: string;
}

/** What gets written into exported files so they can be traced back to the tool, the version and the analysis. */
export function stampOf(piece: Piece, now = new Date()): Stamp {
  return {
    app: APP_NAME,
    version: APP_VERSION,
    exported: now.toISOString(),
    title: displayTitle(piece),
    composer: piece.meta.composer,
    source: piece.meta.source ?? '',
    analyst: piece.meta.analyst ?? '',
    analysisDate: piece.meta.analysisDate ?? '',
  };
}

/** Adds a `<metadata>` element (after `<desc>`) to an SVG string. */
export function withSvgMetadata(svg: string, stamp: Stamp): string {
  const attrs = Object.entries(stamp)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}="${esc(v)}"`)
    .join(' ');
  const tag = `<metadata><tonartenverlauf ${attrs}/></metadata>`;
  const at = svg.indexOf('</desc>');
  return at < 0 ? svg : svg.slice(0, at + 7) + tag + svg.slice(at + 7);
}

/** Writes the stamp into a PNG as international text chunks (iTXt, UTF-8), right after the header. */
export function withPngText(png: Uint8Array, stamp: Stamp, description = ''): Uint8Array {
  const enc = new TextEncoder();
  const entries: [string, string][] = [
    ['Software', `${stamp.app} ${stamp.version}`],
    ['Creation Time', stamp.exported],
    ['Title', stamp.title],
    ['Author', stamp.analyst || stamp.composer],
    ['Source', stamp.source],
    ['Description', description],
  ].filter((e): e is [string, string] => e[1] !== '');
  const chunk = (type: string, data: Uint8Array): Uint8Array => {
    const out = new Uint8Array(12 + data.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    out.set(enc.encode(type), 4);
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };
  const chunks = entries.map(([key, value]) => {
    const k = enc.encode(key);
    const v = enc.encode(value);
    const data = new Uint8Array(k.length + 5 + v.length);
    data.set(k, 0); // keyword, then NUL, compression flag 0, method 0, empty language tag + NUL, empty translated keyword + NUL
    data.set(v, k.length + 5);
    return chunk('iTXt', data);
  });
  const ihdrEnd = 8 + 25; // signature + IHDR chunk
  const out = new Uint8Array(png.length + chunks.reduce((n, c) => n + c.length, 0));
  out.set(png.subarray(0, ihdrEnd), 0);
  let pos = ihdrEnd;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  out.set(png.subarray(ihdrEnd), pos);
  return out;
}
