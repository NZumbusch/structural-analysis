import { keyDistance } from '../domain/distance';
import { keyName, rowLabel, rowOf } from '../domain/keys';
import { formatPos } from '../domain/positions';
import { meterMap, sortedEvents } from '../domain/structure';
import type { Annotation, Lang, PassingChord, Piece, Segment, StructEvent } from '../domain/types';
import { keyDisplay } from './charts';
import { formatNumber, formatPercent, type Column } from './csv';
import type { DistanceStat, KeyStat, Modulation, SectionStat, Span, Stats } from './stats';

/** Every table of the app as data, so the screen, CSV, LaTeX and the clipboard show the same numbers. */

export type Tr = (key: string, params?: Record<string, string | number>) => string;

export interface Table<T> {
  id: string;
  /** Human title of the table. */
  name: string;
  columns: Column<T>[];
  rows: T[];
}

export type ModulationRow = Modulation & { nr: number };
export type SegmentRow = Segment & { nr: number };

export interface Tables {
  segments: Table<SegmentRow>;
  keys: Table<KeyStat>;
  distance: Table<DistanceStat>;
  modulations: Table<ModulationRow>;
  tonicizations: Table<Span>;
  sections: Table<SectionStat>;
  passing: Table<PassingChord>;
  annotations: Table<Annotation>;
  events: Table<StructEvent>;
}

export const TABLE_IDS = ['segments', 'keys', 'distance', 'modulations', 'tonicizations', 'sections', 'passing', 'annotations', 'events'] as const;
export type TableId = (typeof TABLE_IDS)[number];

export function buildTables(piece: Piece, stats: Stats, tr: Tr, lang: Lang): Tables {
  const meter = meterMap(piece);
  const num = (n: number, digits = 2) => formatNumber(n, lang, digits);
  const pct = (n: number) => formatPercent(n, lang);
  const pos = (p: number) => formatPos(p, meter);
  const step = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
  const rowName = (r: number) => rowLabel(r, piece.style.noteNames, piece.style.enharmonic);
  const kindName = (k: string) => tr(`kind.${k}`);
  const names = piece.style.noteNames;
  const center = piece.meta.center;
  const measure = stats.measure;
  const t = (id: TableId): string => tr(`tbl.set.${id}`);
  const R = 'right' as const;

  const segments: Table<SegmentRow> = {
    id: 'segments', name: t('segments'),
    rows: [...piece.segments].sort((a, b) => a.from - b.from || a.to - b.to).map((s, i) => ({ ...s, nr: i + 1 })),
    columns: [
      { key: 'nr', label: tr('tbl.nr'), value: (r) => r.nr, align: R },
      { key: 'from', label: tr('tbl.from'), value: (r) => r.from, text: (r) => pos(r.from), align: R },
      { key: 'to', label: tr('tbl.to'), value: (r) => r.to, text: (r) => pos(r.to), align: R },
      { key: 'len', label: tr('tbl.len'), value: (r) => r.to - r.from, text: (r) => num(r.to - r.from), align: R },
      { key: 'key', label: tr('tbl.key'), value: (r) => keyDisplay(r.key, piece) },
      { key: 'mode', label: tr('tbl.mode'), value: (r) => r.key.mode, text: (r) => (r.key.mode === 'major' ? tr('tbl.major') : tr('tbl.minor')) },
      { key: 'row', label: tr('tbl.row'), value: (r) => rowOf(r.key), text: (r) => rowName(rowOf(r.key)) },
      { key: 'distance', label: tr('tbl.distance'), value: (r) => keyDistance(center, r.key, measure).distance, align: R },
      { key: 'kind', label: tr('tbl.kind'), value: (r) => r.kind, text: (r) => kindName(r.kind) },
      { key: 'label', label: tr('tbl.label'), value: (r) => r.label },
    ],
  };

  const keys: Table<KeyStat> = {
    id: 'keys', name: t('keys'), rows: stats.keys,
    columns: [
      { key: 'key', label: tr('tbl.key'), value: (r) => keyDisplay(r.key, piece) },
      { key: 'row', label: tr('tbl.row'), value: (r) => r.row, text: (r) => rowName(r.row) },
      { key: 'distance', label: tr('tbl.distance'), value: (r) => r.distance, align: R },
      { key: 'bars', label: tr('tbl.bars'), value: (r) => r.bars, text: (r) => num(r.bars), align: R },
      { key: 'share', label: tr('tbl.share'), value: (r) => r.share, text: (r) => pct(r.share), align: R },
      { key: 'dominant', label: tr('tbl.dominantBars'), value: (r) => r.dominant, text: (r) => num(r.dominant), align: R },
      { key: 'visits', label: tr('tbl.visits'), value: (r) => r.visits, align: R },
      { key: 'longest', label: tr('tbl.longest'), value: (r) => r.longest, text: (r) => num(r.longest), align: R },
      { key: 'first', label: tr('tbl.first'), value: (r) => r.first, text: (r) => pos(r.first), align: R },
    ],
  };

  const distance: Table<DistanceStat> = {
    id: 'distance', name: t('distance'), rows: stats.distances,
    columns: [
      { key: 'signed', label: tr('tbl.distance'), value: (r) => r.signed, text: (r) => step(r.signed), align: R },
      ...(measure === 'rows' ? [{ key: 'row', label: tr('tbl.row'), value: (r: DistanceStat) => r.signed, text: (r: DistanceStat) => rowName(stats.centerRow + r.signed) }] : []),
      { key: 'major', label: tr('tbl.major'), value: (r) => r.major, text: (r) => num(r.major), align: R },
      { key: 'minor', label: tr('tbl.minor'), value: (r) => r.minor, text: (r) => num(r.minor), align: R },
      { key: 'bars', label: tr('tbl.bars'), value: (r) => r.bars, text: (r) => num(r.bars), align: R },
      { key: 'share', label: tr('tbl.share'), value: (r) => r.share, text: (r) => pct(r.share), align: R },
    ],
  };

  const modulations: Table<ModulationRow> = {
    id: 'modulations', name: t('modulations'), rows: stats.modulations.map((m, i) => ({ ...m, nr: i + 1 })),
    columns: [
      { key: 'nr', label: tr('tbl.nr'), value: (r) => r.nr, align: R },
      { key: 'pos', label: tr('tbl.pos'), value: (r) => r.pos, text: (r) => pos(r.pos), align: R },
      { key: 'from', label: tr('tbl.fromKey'), value: (r) => keyDisplay(r.from, piece) },
      { key: 'to', label: tr('tbl.toKey'), value: (r) => keyDisplay(r.to, piece) },
      { key: 'step', label: tr('tbl.step'), value: (r) => r.step, text: (r) => step(r.step), align: R },
      { key: 'after', label: tr('tbl.distAfter'), value: (r) => r.distanceAfter, align: R },
      { key: 'section', label: tr('tbl.section'), value: (r) => r.section },
    ],
  };

  const tonicizations: Table<Span> = {
    id: 'tonicizations', name: t('tonicizations'), rows: stats.spans.filter((s) => s.kind !== 'key'),
    columns: [
      { key: 'from', label: tr('tbl.pos'), value: (r) => r.from, text: (r) => pos(r.from), align: R },
      { key: 'to', label: tr('tbl.to'), value: (r) => r.to, text: (r) => pos(r.to), align: R },
      { key: 'kind', label: tr('tbl.kind'), value: (r) => kindName(r.kind) },
      { key: 'target', label: tr('tbl.target'), value: (r) => keyDisplay(r.key, piece) },
      { key: 'len', label: tr('tbl.len'), value: (r) => r.to - r.from, text: (r) => num(r.to - r.from), align: R },
    ],
  };

  const sections: Table<SectionStat> = {
    id: 'sections', name: t('sections'), rows: stats.sections,
    columns: [
      { key: 'name', label: tr('tbl.name'), value: (r) => r.name },
      { key: 'range', label: tr('tbl.range'), value: (r) => r.from, text: (r) => `${pos(r.from)}–${pos(r.to)}` },
      { key: 'bars', label: tr('tbl.analysed'), value: (r) => r.bars, text: (r) => num(r.bars), align: R },
      { key: 'home', label: tr('tbl.homeShare'), value: (r) => r.homeShare, text: (r) => pct(r.homeShare), align: R },
      { key: 'mean', label: tr('tbl.meanDist'), value: (r) => r.meanDistance, text: (r) => num(r.meanDistance), align: R },
      { key: 'max', label: tr('tbl.maxDist'), value: (r) => r.maxDistance, align: R },
      { key: 'keys', label: tr('tbl.keysN'), value: (r) => r.keys, align: R },
    ],
  };

  const passing: Table<PassingChord> = {
    id: 'passing', name: t('passing'), rows: [...piece.passing].sort((a, b) => a.pos - b.pos),
    columns: [
      { key: 'pos', label: tr('tbl.pos'), value: (r) => r.pos, text: (r) => pos(r.pos), align: R },
      { key: 'key', label: tr('tbl.key'), value: (r) => keyDisplay(r.key, piece) },
      { key: 'row', label: tr('tbl.row'), value: (r) => rowOf(r.key), text: (r) => rowName(rowOf(r.key)) },
    ],
  };

  const annotations: Table<Annotation> = {
    id: 'annotations', name: t('annotations'), rows: [...piece.annotations].sort((a, b) => a.pos - b.pos),
    columns: [
      { key: 'pos', label: tr('tbl.pos'), value: (r) => r.pos, text: (r) => pos(r.pos), align: R },
      { key: 'key', label: tr('tbl.key'), value: (r) => keyName(r.key, names) },
      { key: 'text', label: tr('tbl.label'), value: (r) => r.text },
    ],
  };

  const detail = (e: StructEvent): string => {
    switch (e.kind) {
      case 'meter': return `${e.beats}/${e.unit}`;
      case 'repeat-end': return `${e.times}×`;
      case 'volta': return `${e.numbers.join(',')}. (${pos(e.pos)}–${pos(e.to)})`;
      case 'section': case 'subsection': return e.name;
      case 'marker': case 'text': return e.label;
      case 'barline': return e.style;
      case 'keysig': return String(e.fifths);
      default: return '';
    }
  };
  const events: Table<StructEvent> = {
    id: 'events', name: t('events'), rows: sortedEvents(piece),
    columns: [
      { key: 'pos', label: tr('tbl.pos'), value: (r) => r.pos, text: (r) => pos(r.pos), align: R },
      { key: 'kind', label: tr('tbl.kind'), value: (r) => r.kind, text: (r) => tr(`ev.${r.kind}`) },
      { key: 'details', label: tr('tbl.details'), value: (r) => detail(r) },
    ],
  };

  return { segments, keys, distance, modulations, tonicizations, sections, passing, annotations, events };
}

// ---- LaTeX --------------------------------------------------------------------------------------------------

const LATEX_MAP: Record<string, string> = {
  '\\': '\\textbackslash{}', '&': '\\&', '%': '\\%', $: '\\$', '#': '\\#', _: '\\_', '{': '\\{', '}': '\\}',
  '~': '\\textasciitilde{}', '^': '\\textasciicircum{}',
  '−': '$-$', '–': '--', '—': '---', '·': '\\textperiodcentered{}', '×': '$\\times$',
  '„': '\\quotedblbase{}', '“': '\\textquotedblleft{}', '”': '\\textquotedblright{}',
};

/** Makes text safe for LaTeX (special characters, typographic dashes and quotes). */
export function latexEscape(text: string): string {
  let out = '';
  for (const ch of text) out += LATEX_MAP[ch] ?? ch;
  return out.replace(/ \\%/g, '\\,\\%'); // thin space before a percent sign
}

export interface LatexOptions {
  /** Wrap in a table environment with caption and label. */
  floating?: boolean;
  caption?: string;
  label?: string;
}

/** A booktabs table (`\usepackage{booktabs}` needed). */
export function toLatex<T>(table: Table<T>, options: LatexOptions = {}): string {
  const align = table.columns.map((c) => (c.align === 'right' ? 'r' : 'l')).join('');
  const cell = (c: Column<T>, r: T) => latexEscape(c.text ? c.text(r) : String(c.value(r)));
  const body = [
    `\\begin{tabular}{${align}}`,
    '\\toprule',
    `${table.columns.map((c) => latexEscape(c.label)).join(' & ')} \\\\`,
    '\\midrule',
    ...table.rows.map((r) => `${table.columns.map((c) => cell(c, r)).join(' & ')} \\\\`),
    '\\bottomrule',
    '\\end{tabular}',
  ];
  if (!options.floating) return `% requires \\usepackage{booktabs}\n${body.join('\n')}\n`;
  return [
    '% requires \\usepackage{booktabs}',
    '\\begin{table}[tbp]',
    '\\centering',
    ...(options.caption ? [`\\caption{${latexEscape(options.caption)}}`] : []),
    ...(options.label ? [`\\label{${options.label}}`] : []),
    ...body,
    '\\end{table}',
    '',
  ].join('\n');
}
