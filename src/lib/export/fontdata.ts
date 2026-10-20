import * as opentype from 'opentype.js';
import type { FontFamilyId } from '../domain/types';
import { FAMILY_NAME, FONT_FILES, UNICODE_RANGE, familyOf, fontFile, type FontFile, type Subset, type Weight } from '../render/fonts';

/** Font data for exports: embedding into SVG, turning text into outlines, and the PDF writer. */

type Loader = (url: string) => Promise<ArrayBuffer>;

let loader: Loader = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`font ${url}: ${response.status}`);
  return response.arrayBuffer();
};
const bytes = new Map<string, Promise<ArrayBuffer>>();
const parsed = new Map<string, Promise<opentype.Font>>();

/** Lets tests (or other hosts) supply the font files themselves. */
export function setFontLoader(fn: Loader): void {
  loader = fn;
  bytes.clear();
  parsed.clear();
}

export function fontBytes(file: FontFile): Promise<ArrayBuffer> {
  let p = bytes.get(file.url);
  if (!p) {
    p = loader(file.url);
    bytes.set(file.url, p);
  }
  return p;
}

export function loadFont(file: FontFile): Promise<opentype.Font> {
  let p = parsed.get(file.url);
  if (!p) {
    p = fontBytes(file).then((b) => opentype.parse(b.slice(0)));
    parsed.set(file.url, p);
  }
  return p;
}

const OUTSIDE_LATIN = /[^\u0000-ÿıŒœʻʼˆ˚˜ -⁯€™↑↓−∕﻿�]/;

/** Subsets needed to show this text. */
export function subsetsFor(text: string): Subset[] {
  return OUTSIDE_LATIN.test(text) ? ['latin', 'latin-ext'] : ['latin'];
}

// ---- reading our own SVG ---------------------------------------------------------------------------------

export const unescapeXml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

export function parseAttrs(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of source.matchAll(/([\w:-]+)="([^"]*)"/g)) out[m[1]] = unescapeXml(m[2]);
  return out;
}

export const svgFamily = (svg: string): FontFamilyId => familyOf(parseAttrs(svg.slice(0, svg.indexOf('>') + 1))['font-family'] ?? '');

const textOf = (svg: string) =>
  [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((m) => unescapeXml(m[1])).join('') + (svg.match(/<(?:title|desc)>([\s\S]*?)<\//g) ?? []).join('');

// ---- embedding -------------------------------------------------------------------------------------------------

function base64(buffer: ArrayBuffer): string {
  const view = new Uint8Array(buffer);
  let s = '';
  for (let i = 0; i < view.length; i += 0x8000) s += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return btoa(s);
}

/** @font-face rules (with the font data inside) for the font and weights a figure uses. */
export async function embeddedFontCss(svg: string): Promise<string> {
  const family = svgFamily(svg);
  const weights: Weight[] = /font-weight="(?:500|600|700)"/.test(svg) ? [400, 500] : [400];
  const rules: string[] = [];
  for (const subset of subsetsFor(textOf(svg))) {
    for (const weight of weights) {
      const data = await fontBytes(fontFile(family, weight, subset));
      rules.push(
        `@font-face{font-family:'${FAMILY_NAME[family]}';font-style:normal;font-weight:${weight};` +
          `src:url(data:font/woff;base64,${base64(data)}) format('woff');unicode-range:${UNICODE_RANGE[subset]}}`,
      );
    }
  }
  return rules.join('');
}

/** The SVG with the chart's font embedded, so it looks the same wherever it is opened. */
export async function embedFonts(svg: string): Promise<string> {
  const css = await embeddedFontCss(svg);
  const open = svg.indexOf('>') + 1;
  return `${svg.slice(0, open)}<defs><style>${css}</style></defs>${svg.slice(open)}`;
}

// ---- outlines ------------------------------------------------------------------------------------------------------

export interface Outlined {
  svg: string;
  /** Text runs that could not be converted because a character is not in the font. */
  missing: number;
}

/** Replaces every text element by the outlines of its glyphs. */
export async function outlineText(svg: string): Promise<Outlined> {
  const family = svgFamily(svg);
  const fonts: Record<Weight, opentype.Font[]> = { 400: [], 500: [] };
  for (const w of [400, 500] as Weight[]) {
    for (const subset of ['latin', 'latin-ext'] as Subset[]) fonts[w].push(await loadFont(fontFile(family, w, subset)));
  }
  let missing = 0;
  const out = svg.replace(/<text\b([^>]*)>([\s\S]*?)<\/text>/g, (whole, attrSrc: string, content: string) => {
    const a = parseAttrs(attrSrc);
    const text = unescapeXml(content);
    const size = parseFloat(a['font-size'] ?? '12');
    const x = parseFloat(a.x ?? '0');
    let y = parseFloat(a.y ?? '0');
    if (a.dy?.endsWith('em')) y += parseFloat(a.dy) * size;
    const set = fonts[parseInt(a['font-weight'] ?? '400', 10) >= 500 ? 500 : 400];

    // split into runs that each come from one font file
    const runs: { font: opentype.Font; text: string }[] = [];
    for (const ch of text) {
      const font = set.find((f) => f.charToGlyphIndex(ch) > 0);
      if (!font) {
        missing++;
        return whole;
      }
      const last = runs[runs.length - 1];
      if (last && last.font === font) last.text += ch;
      else runs.push({ font, text: ch });
    }
    // Glyph by glyph: opentype.js's text shaping does not cope with every feature of modern fonts.
    const glyphs = runs.flatMap((r) => [...r.text].map((ch) => ({ font: r.font, glyph: r.font.glyphs.get(r.font.charToGlyphIndex(ch)) })));
    const advance = (g: (typeof glyphs)[number]) => (g.glyph.advanceWidth * size) / g.font.unitsPerEm;
    const total = glyphs.reduce((sum, g) => sum + advance(g), 0);
    let cursor = x - (a['text-anchor'] === 'middle' ? total / 2 : a['text-anchor'] === 'end' ? total : 0);
    const d: string[] = [];
    for (const g of glyphs) {
      d.push(g.glyph.getPath(cursor, y, size).toPathData(2));
      cursor += advance(g);
    }
    const italic = a['font-style'] === 'italic' ? ` transform="matrix(1 0 -0.2 1 ${(0.2 * y).toFixed(2)} 0)"` : '';
    return `<path d="${d.join('')}" fill="${a.fill ?? '#000'}"${italic}/>`;
  });
  return { svg: out, missing };
}

// ---- font files for PDF ------------------------------------------------------------------------------------------------

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Unpacks a WOFF 1.0 file into a plain TrueType/OpenType font file (what PDF embeds). */
export async function woffToSfnt(woff: ArrayBuffer): Promise<Uint8Array> {
  const view = new DataView(woff);
  const src = new Uint8Array(woff);
  if (view.getUint32(0) !== 0x774f4646) throw new Error('not a WOFF file');
  const flavor = view.getUint32(4);
  const count = view.getUint16(12);
  const tables: { tag: string; data: Uint8Array; offset: number }[] = [];
  for (let i = 0; i < count; i++) {
    const o = 44 + i * 20;
    const tag = String.fromCharCode(src[o], src[o + 1], src[o + 2], src[o + 3]);
    const offset = view.getUint32(o + 4);
    const comp = view.getUint32(o + 8);
    const orig = view.getUint32(o + 12);
    const raw = src.subarray(offset, offset + comp);
    tables.push({ tag, data: comp < orig ? (await inflate(raw)).subarray(0, orig) : raw.slice(), offset: 0 });
  }
  tables.sort((a, b) => (a.tag < b.tag ? -1 : 1));
  let pos = 12 + count * 16;
  for (const t of tables) {
    t.offset = pos;
    pos += (t.data.length + 3) & ~3;
  }
  const out = new Uint8Array(pos);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, flavor);
  dv.setUint16(4, count);
  let pow = 1;
  let log = 0;
  while (pow * 2 <= count) {
    pow *= 2;
    log++;
  }
  dv.setUint16(6, pow * 16);
  dv.setUint16(8, log);
  dv.setUint16(10, count * 16 - pow * 16);
  const checksum = (d: Uint8Array) => {
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      sum = (sum + (((d[i] << 24) | ((d[i + 1] ?? 0) << 16) | ((d[i + 2] ?? 0) << 8) | (d[i + 3] ?? 0)) >>> 0)) >>> 0;
    }
    return sum;
  };
  let headAt = -1;
  tables.forEach((t, i) => {
    const e = 12 + i * 16;
    for (let k = 0; k < 4; k++) out[e + k] = t.tag.charCodeAt(k);
    if (t.tag === 'head') {
      headAt = t.offset;
      t.data[8] = t.data[9] = t.data[10] = t.data[11] = 0; // checkSumAdjustment is computed below
    }
    dv.setUint32(e + 4, checksum(t.data));
    dv.setUint32(e + 8, t.offset);
    dv.setUint32(e + 12, t.data.length);
    out.set(t.data, t.offset);
  });
  if (headAt >= 0) dv.setUint32(headAt + 8, (0xb1b0afba - checksum(out)) >>> 0);
  return out;
}

export { FONT_FILES };
