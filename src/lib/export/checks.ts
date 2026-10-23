import { displayTitle } from '../domain/piece';
import type { Piece } from '../domain/types';
import { computeStats } from '../analysis/stats';
import { FS, renderChart, type ViewRange } from '../render/chart';
import { subsetOf } from '../render/fonts';
import { activePalette } from '../render/palettes';
import type { TKey } from '../i18n/index.svelte';
import type { FontMode } from './files';

export type CheckLevel = 'ok' | 'warn' | 'info';
export interface Check {
  id: string;
  level: CheckLevel;
  key: TKey;
  params: Record<string, string | number>;
}

export interface CheckContext {
  widthCm: number;
  fonts: FontMode;
  /** Open items in the data check (errors and warnings). */
  problems: number;
  view?: ViewRange | null;
  /** Language of the decimal separator in the texts (default: point). */
  lang?: 'de' | 'en';
}

const MIN_TEXT_PT = 6;
const MIN_LINE_PT = 0.25;
const dec = (n: number, digits: number, lang?: 'de' | 'en') => {
  const text = String(Math.round(n * 10 ** digits) / 10 ** digits);
  return lang === 'de' ? text.replace('.', ',') : text;
};

const covered = (cp: number) => cp < 32 || subsetOf(cp) !== null;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Characters in the drawn text that the bundled fonts have no glyph for (they would be missing in PDF and outlines). */
export function uncoveredCharacters(svg: string): string[] {
  const text = [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)]
    .map((m) => m[1].replace(/<[^>]+>/g, ''))
    .join('')
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (_, e: string) =>
      e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENTITIES[e] ?? ''),
    );
  const out = new Set<string>();
  for (const ch of text) if (!covered(ch.codePointAt(0)!) && !/\s/.test(ch)) out.add(ch);
  return [...out];
}

/** Things that go wrong in print and in papers, checked against the current settings. */
export function publicationChecks(piece: Piece, ctx: CheckContext): Check[] {
  const st = piece.style;
  const out: Check[] = [];
  const add = (id: string, level: CheckLevel, params: Check['params'] = {}) =>
    out.push({ id, level, key: `chk.${id}.${level === 'info' ? 'info' : level}` as TKey, params });

  const chart = renderChart(piece, { view: ctx.view });
  const ptPerUnit = ((ctx.widthCm / 2.54) * 72) / chart.width;

  // text: the smallest text that is drawn
  const hasBarLabels = st.show.barLabels && piece.segments.some((s) => s.label.trim());
  const smallest = (hasBarLabels ? Math.min(FS.small, FS.barLabel) : FS.small) * st.fontScale * ptPerUnit;
  add('textSize', smallest >= MIN_TEXT_PT ? 'ok' : 'warn', { pt: dec(smallest, 1, ctx.lang), cm: dec(ctx.widthCm, 1, ctx.lang) });

  // lines: the thinnest stroke in the drawing
  const widths = [...chart.svg.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1])).filter((w) => w > 0);
  const thinnest = (widths.length ? Math.min(...widths) : 1) * ptPerUnit;
  add('lines', thinnest >= MIN_LINE_PT ? 'ok' : 'warn', { pt: dec(thinnest, 2, ctx.lang) });

  add('fonts', ctx.fonts === 'none' ? 'warn' : 'ok');
  const missing = uncoveredCharacters(chart.svg);
  if (missing.length > 0) add('glyphs', 'warn', { chars: missing.slice(0, 8).join(' ') });
  add('valid', ctx.problems > 0 ? 'warn' : 'ok', { n: ctx.problems });
  add('source', piece.meta.source.trim() ? 'ok' : 'warn');

  // a saved image description that quotes a number of key changes must still agree with the data
  const alt = piece.meta.altText?.trim() ?? '';
  const quoted = alt.match(/(\d+) (?:Wechsel|changes of key)/);
  if (quoted) add('alt', Number(quoted[1]) === computeStats(piece).summary.modulations ? 'ok' : 'warn');

  const measure = piece.meta.distanceMeasure ?? 'rows';
  if (measure !== 'rows' && st.show.fifthsColumn) add('measure', 'warn', { measure });

  const readableInGrey = st.hatch || activePalette(st.colors) === 'mono';
  add('color', readableInGrey ? 'ok' : 'warn');

  if (st.show.title && displayTitle(piece).trim()) add('title', 'info');
  return out;
}

export const countNotes = (checks: Check[]) => checks.filter((c) => c.level !== 'ok').length;
