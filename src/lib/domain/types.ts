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
}

/** A chord that only passes through and does not establish a key. */
export interface PassingChord {
  id: string;
  bar: number;
  key: Key;
}

/** Free text label placed to the side of `bar` in the row of `key`. */
export interface Annotation {
  id: string;
  bar: number;
  key: Key;
  text: string;
  align: 'left' | 'right';
}

/** A formal section; it ends where the next one starts. */
export interface Section {
  id: string;
  name: string;
  from: number;
  shade: boolean;
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
  sectionBands: boolean;
  centerBand: boolean;
  grid: boolean;
  rowLabels: boolean;
  connectors: boolean;
  fifthsColumn: boolean;
  axis: boolean;
  legend: boolean;
}

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
  sections: Section[];
  highlights: Highlight[];
  style: Style;
}
