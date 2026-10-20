/** Core data model. Everything here is plain JSON so it can be stored and exported as-is. */

export type Mode = 'major' | 'minor';
export type NoteNames = 'de' | 'en';
export type Lang = 'de' | 'en';

/**
 * A key, identified by its tonic's position on the circle of fifths counted from C
 * (… Es = -3, B = -2, F = -1, C = 0, G = 1, D = 2 …) plus its mode.
 */
export interface Key {
  fifths: number;
  mode: Mode;
}

export type SegmentKind = 'key' | 'dominant';

/** A stretch of music in one key. `to` is the bar where the next stretch begins (exclusive). */
export interface Segment {
  id: string;
  from: number;
  to: number;
  key: Key;
  /** 'dominant' = secondary dominant aiming at `key`, drawn dashed. */
  kind: SegmentKind;
  /** Optional text on the bar (chord, function …). */
  label: string;
}

/** A chord that only passes through and does not establish a key. `pos` is a position in bars (74.5 = middle of bar 74). */
export interface PassingChord {
  id: string;
  pos: number;
  key: Key;
}

/** Free text anchored at `pos` in the row of `key`, optionally nudged by `dx`/`dy` (chart units). */
export interface Annotation {
  id: string;
  pos: number;
  key: Key;
  text: string;
  align: 'left' | 'right';
  dx: number;
  dy: number;
  hidden: boolean;
}

export type EventKind =
  | 'meter'
  | 'repeat-start'
  | 'repeat-end'
  | 'volta'
  | 'section'
  | 'subsection'
  | 'marker'
  | 'text'
  | 'barline'
  | 'keysig'
  | 'fermata';

/**
 * Something placed at a position in the score structure. Only the fields that belong to `kind` are
 * used; the rest keep their defaults so the JSON stays flat and easy to migrate.
 */
export interface StructEvent {
  id: string;
  kind: EventKind;
  /** Position in bars (a repeat sign "after bar 8" sits at 9). */
  pos: number;
  /** meter */
  beats: number;
  unit: number;
  /** repeat-end: how often the passage is played (2 = once repeated). */
  times: number;
  /** volta: exclusive end of the ending. */
  to: number;
  /** volta: which passes play this ending (1 = 1st ending). */
  numbers: number[];
  /** section / subsection */
  name: string;
  /** section: shaded background in the chart. */
  shade: boolean;
  /** marker / text */
  label: string;
  /** marker: dashed line through the chart. */
  line: boolean;
  /** barline */
  style: 'double' | 'final';
  /** keysig: -7 (7 flats) … 7 (7 sharps) */
  fifths: number;
}

/** A named zoom range; `to` is exclusive like a segment's. */
export interface View {
  id: string;
  name: string;
  from: number;
  to: number;
}

export interface Meter {
  /** Beats per bar (numerator). */
  beats: number;
  /** Note value of one beat (denominator): 4 = quarter, 8 = eighth. */
  unit: number;
}

/** A coloured band over bars `from`..`to` (inclusive) with an optional label. */
export interface Highlight {
  id: string;
  from: number;
  to: number;
  label: string;
  color: string;
}

export interface PieceMeta {
  title: string;
  composer: string;
  year: string;
  catalog: string;
  movement: string;
  /** Home key; its row becomes the centre of the fifths scale. */
  center: Key;
  /** Time signature until a meter event changes it. */
  meter: Meter;
  /** Length of an anacrusis in beats (0 = none); it counts as bar 0. */
  pickup: number;
  /** Empty = generated automatically. */
  subtitle: string;
  /** Null = derived from the last segment. */
  lastBar: number | null;
  notes: string;
}

export interface Palette {
  majorFill: string;
  majorStroke: string;
  minorFill: string;
  minorStroke: string;
  text: string;
  muted: string;
  grid: string;
  axis: string;
  link: string;
  sectionBand: string;
  centerBand: string;
  surface: string;
  background: string;
}

export interface ShowOptions {
  subtitle: boolean;
  sectionLabels: boolean;
  subsections: boolean;
  repeats: boolean;
  meterSigns: boolean;
  annotations: boolean;
  barLabels: boolean;
  markers: boolean;
  viewRange: boolean;
  sectionBands: boolean;
  centerBand: boolean;
  grid: boolean;
  rowLabels: boolean;
  connectors: boolean;
  fifthsColumn: boolean;
  axis: boolean;
  legend: boolean;
}

export type Auto = 'auto' | 'on' | 'off';
export type FontFamilyId = 'sans' | 'serif' | 'mono';
export type TitleLayout = 'composer-title' | 'title-composer' | 'title';

export interface Style {
  colors: Palette;
  language: Lang;
  noteNames: NoteNames;
  titleLayout: TitleLayout;
  showYear: boolean;
  fontFamily: FontFamilyId;
  fontScale: number;
  barWidth: number;
  rowHeight: number;
  barHeight: number;
  /** Plot width of zoomed views, in chart units. */
  detailWidth: number;
  barLines: Auto;
  beatTicks: Auto;
  /** Which spelling the outer rows get: natural (auto), flat or sharp keys. */
  enharmonic: 'auto' | 'flats' | 'sharps';
  /** Repeats as signs on a single pass, or the bars laid out in play order. */
  repeatDisplay: 'symbols' | 'expanded';
  /** Manual row labels by row number (fifths from C); empty = automatic. */
  rowNames: Record<string, string>;
  /** 0 = automatic */
  tickStep: number;
  /** Extra empty rows above and below the used range. */
  extraRows: number;
  /** Null = automatic */
  rowMax: number | null;
  rowMin: number | null;
  transparentBackground: boolean;
  show: ShowOptions;
}

export interface Piece {
  version: 1;
  id: string;
  createdAt: number;
  updatedAt: number;
  meta: PieceMeta;
  segments: Segment[];
  passing: PassingChord[];
  annotations: Annotation[];
  highlights: Highlight[];
  /** Meters, repeats, endings, sections, markers … in the order they appear. */
  events: StructEvent[];
  views: View[];
  style: Style;
}
