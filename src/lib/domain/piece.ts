import { CLASSIC } from '../render/palettes';
import { newId } from './ids';
import type { Key, Piece, PieceMeta, Style } from './types';

export const DEFAULT_STYLE: Style = {
  colors: { ...CLASSIC },
  language: 'de',
  noteNames: 'de',
  titleLayout: 'composer-title',
  showYear: false,
  fontFamily: 'sans',
  fontScale: 1,
  barWidth: 6,
  rowHeight: 36,
  barHeight: 14,
  tickStep: 0,
  extraRows: 0,
  rowMax: null,
  rowMin: null,
  transparentBackground: false,
  show: {
    subtitle: true,
    sectionLabels: true,
    sectionBands: true,
    centerBand: true,
    grid: true,
    rowLabels: true,
    connectors: true,
    fifthsColumn: true,
    axis: true,
    legend: true,
  },
};

export function cloneStyle(style: Style = DEFAULT_STYLE): Style {
  return JSON.parse(JSON.stringify(style));
}

export function createPiece(overrides: Partial<Piece> = {}, style: Style = DEFAULT_STYLE): Piece {
  const now = Date.now();
  const center: Key = { fifths: 0, mode: 'major' };
  const meta: PieceMeta = {
    title: '', composer: '', year: '', catalog: '', movement: '',
    center, subtitle: '', lastBar: null, notes: '',
  };
  return {
    version: 1,
    id: newId(),
    createdAt: now,
    updatedAt: now,
    meta,
    segments: [],
    passing: [],
    annotations: [],
    sections: [],
    highlights: [],
    style: cloneStyle(style),
    ...overrides,
  };
}

/** The bar after which nothing is drawn: explicit setting, else the end of the last segment. */
export function lastBarOf(piece: Piece): number {
  if (piece.meta.lastBar && piece.meta.lastBar >= 1) return Math.floor(piece.meta.lastBar);
  const ends = [
    ...piece.segments.map((s) => s.to - 1),
    ...piece.passing.map((p) => p.bar),
    ...piece.highlights.map((h) => h.to),
  ];
  return Math.max(8, Math.ceil(Math.max(0, ...ends)));
}

/** The text shown as the headline of the chart. */
export function displayTitle(piece: Piece): string {
  const { title, composer, year, movement } = piece.meta;
  const main = [title, movement].filter((s) => s.trim()).join(', ');
  let line = main;
  if (composer.trim()) {
    if (piece.style.titleLayout === 'composer-title') line = main ? `${composer} · ${main}` : composer;
    else if (piece.style.titleLayout === 'title-composer') line = main ? `${main} · ${composer}` : composer;
  }
  if (piece.style.showYear && year.trim()) line += ` (${year.trim()})`;
  return line;
}

export function fileSlug(piece: Piece): string {
  const raw = [piece.meta.composer, piece.meta.title, piece.meta.movement].filter(Boolean).join(' ');
  const slug = raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'tonartenverlauf';
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function mergeDeep<T>(base: T, patch: unknown): T {
  if (!isObj(base) || !isObj(patch)) return (patch === undefined || patch === null ? base : (patch as T));
  const out: Record<string, unknown> = { ...base };
  for (const k of Object.keys(patch)) out[k] = k in base ? mergeDeep((base as Record<string, unknown>)[k], patch[k]) : patch[k];
  return out as T;
}

/**
 * Turns anything that looks like a piece (stored data, imported file) into a valid Piece.
 * Missing fields are filled from defaults so files from older versions keep loading.
 * Returns null when the data is not a piece at all.
 */
export function normalizePiece(data: unknown): Piece | null {
  if (!isObj(data) || !isObj(data.meta) || !Array.isArray(data.segments)) return null;
  const base = createPiece();
  const piece = mergeDeep(base, data) as Piece;
  piece.version = 1;
  piece.id = typeof data.id === 'string' && data.id ? data.id : base.id;
  const validKey = (k: unknown): k is Key =>
    isObj(k) && typeof k.fifths === 'number' && (k.mode === 'major' || k.mode === 'minor');
  piece.segments = (data.segments as unknown[]).filter(
    (s): s is Piece['segments'][number] => isObj(s) && validKey(s.key) && typeof s.from === 'number' && typeof s.to === 'number',
  ).map((s) => ({ ...s, id: s.id || newId(), kind: s.kind === 'dominant' ? 'dominant' : 'key' }));
  for (const list of ['passing', 'annotations', 'sections', 'highlights'] as const) {
    const src = Array.isArray(data[list]) ? (data[list] as unknown[]) : [];
    (piece[list] as unknown[]) = src.filter(isObj).map((x) => ({ ...x, id: typeof x.id === 'string' && x.id ? x.id : newId() }));
  }
  piece.passing = piece.passing.filter((p) => validKey(p.key));
  piece.annotations = piece.annotations.filter((a) => validKey(a.key));
  if (!validKey(piece.meta.center)) piece.meta.center = base.meta.center;
  return piece;
}
