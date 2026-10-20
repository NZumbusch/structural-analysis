import { CLASSIC } from '../render/palettes';
import { newId } from './ids';
import { DEFAULT_METER } from './positions';
import { makeEvent } from './structure';
import { TONICIZATIONS, type Key, type Piece, type PieceMeta, type Style } from './types';

export const DEFAULT_STYLE: Style = {
  colors: { ...CLASSIC },
  language: 'de',
  noteNames: 'de',
  titleLayout: 'composer-title',
  showYear: false,
  fontFamily: 'sans',
  fontScale: 1,
  barWidth: 0,
  rowHeight: 36,
  barHeight: 14,
  detailWidth: 720,
  barLines: 'auto',
  beatTicks: 'auto',
  enharmonic: 'auto',
  repeatDisplay: 'symbols',
  rowNames: {},
  tickStep: 0,
  extraRows: 0,
  rowMax: null,
  rowMin: null,
  transparentBackground: false,
  hatch: false,
  show: {
    subtitle: true,
    sectionLabels: true,
    subsections: true,
    repeats: true,
    meterSigns: true,
    annotations: true,
    barLabels: true,
    markers: true,
    viewRange: true,
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
    center, meter: { ...DEFAULT_METER }, pickup: 0, distanceMeasure: 'rows', subtitle: '', lastBar: 16, notes: '', altText: '', source: '', analyst: '', analysisDate: '',
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
    highlights: [],
    events: [],
    views: [],
    style: cloneStyle(style),
    ...overrides,
  };
}

export { lastBarOf } from './structure';

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

/** Fills a style from an older version (or garbage) up to the current shape. */
export function normalizeStyle(raw: unknown): Style {
  return mergeDeep(cloneStyle(DEFAULT_STYLE), isObj(raw) ? raw : {});
}

function mergeDeep<T>(base: T, patch: unknown): T {
  if (!isObj(base)) return patch === undefined || patch === null ? base : (patch as T);
  if (!isObj(patch)) return base; // wrong shape in a stored file: keep the default
  const out: Record<string, unknown> = { ...base };
  for (const k of Object.keys(patch)) out[k] = k in base ? mergeDeep((base as Record<string, unknown>)[k], patch[k]) : patch[k];
  return out as T;
}

/** Reads `events`, and turns the `sections` and `markers` of earlier versions into events. */
function migrateEvents(data: Record<string, unknown>): Piece['events'] {
  const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter(isObj) : []);
  const events: Piece['events'] = [];
  for (const raw of list(data.events)) {
    if (typeof raw.pos !== 'number' || typeof raw.kind !== 'string') continue;
    events.push(makeEvent(raw.kind as Piece['events'][number]['kind'], raw.pos, { ...(raw as object), id: typeof raw.id === 'string' && raw.id ? raw.id : newId() }));
  }
  for (const s of list(data.sections)) {
    if (typeof s.from === 'number') events.push(makeEvent('section', s.from, { id: typeof s.id === 'string' ? s.id : newId(), name: String(s.name ?? ''), shade: s.shade === true }));
  }
  for (const m of list(data.markers)) {
    if (typeof m.pos === 'number') events.push(makeEvent('marker', m.pos, { id: typeof m.id === 'string' ? m.id : newId(), label: String(m.label ?? ''), line: m.line !== false }));
  }
  return events;
}

function migratePos(item: Record<string, unknown>, offset: number): Record<string, unknown> {
  const { bar, ...rest } = item;
  if (typeof rest.pos !== 'number' && typeof bar === 'number') rest.pos = bar + offset;
  return rest;
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
  ).map((s) => ({ ...s, id: s.id || newId(), kind: (TONICIZATIONS as string[]).includes(s.kind) ? s.kind : 'key', label: typeof s.label === 'string' ? s.label : '' }));
  for (const list of ['passing', 'annotations', 'highlights', 'views'] as const) {
    const src = Array.isArray(data[list]) ? (data[list] as unknown[]) : [];
    (piece[list] as unknown[]) = src.filter(isObj).map((x) => ({ ...x, id: typeof x.id === 'string' && x.id ? x.id : newId() }));
  }
  piece.events = migrateEvents(data);
  // Files from the first version stored whole bars as `bar`; a passing chord sat in the middle of its bar.
  piece.passing = piece.passing
    .map((p) => migratePos(p as unknown as Record<string, unknown>, 0.5) as unknown as Piece['passing'][number])
    .filter((p) => validKey(p.key) && typeof p.pos === 'number');
  piece.annotations = piece.annotations
    .map((a) => ({ align: 'left', dx: 0, dy: 0, hidden: false, ...(migratePos(a as unknown as Record<string, unknown>, 0) as object) }) as Piece['annotations'][number])
    .filter((a) => validKey(a.key) && typeof a.pos === 'number');
  piece.views = piece.views.filter((v) => typeof v.from === 'number' && typeof v.to === 'number' && v.to > v.from);
  if (!(piece.meta.meter?.beats >= 1 && piece.meta.meter?.unit >= 1)) piece.meta.meter = { ...DEFAULT_METER };
  if (!validKey(piece.meta.center)) piece.meta.center = base.meta.center;
  // Earlier versions stored "derive the last bar from the content" as null; keep that meaning.
  if (data.meta.lastBar === null || data.meta.lastBar === undefined) piece.meta.lastBar = null;
  return piece;
}
