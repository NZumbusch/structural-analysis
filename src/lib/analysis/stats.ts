import { rowOf } from '../domain/keys';
import { lastBarOf } from '../domain/piece';
import type { Key, Piece } from '../domain/types';

/** A stretch of music after overlaps are removed: every moment belongs to at most one span. */
export interface Span {
  from: number;
  to: number;
  key: Key;
  kind: 'key' | 'dominant';
}

export interface KeyStat {
  key: Key;
  row: number;
  /** Distance from the centre in fifths (absolute). */
  distance: number;
  /** Positive = sharp side. */
  signed: number;
  /** Bars in this key, established + secondary dominant. */
  bars: number;
  established: number;
  dominant: number;
  /** Share of all analysed bars, 0..1. */
  share: number;
  /** How many separate times the key is reached (consecutive established stretches count once). */
  visits: number;
  longest: number;
  first: number;
}

export interface DistanceStat {
  signed: number;
  major: number;
  minor: number;
  bars: number;
  share: number;
}

export interface SectionStat {
  name: string;
  from: number;
  to: number;
  bars: number;
  /** Bars in the home row (home key or its relative). */
  home: number;
  homeShare: number;
  meanDistance: number;
  maxDistance: number;
  keys: number;
  /** Bars per distance class: index = distance, the last class collects everything further. */
  byDistance: number[];
}

export interface Modulation {
  pos: number;
  from: Key;
  to: Key;
  /** Change of row in fifths; positive towards sharps. */
  step: number;
  distanceAfter: number;
  section: string;
}

export interface ProfilePoint {
  from: number;
  to: number;
  signed: number;
}

export interface Summary {
  pieceBars: number;
  analysedBars: number;
  gapBars: number;
  distinctKeys: number;
  modulations: number;
  maxDistance: number;
  farthest: { key: Key; pos: number } | null;
  meanDistance: number;
  homeShare: number;
  majorShare: number;
  minorShare: number;
  dominantCount: number;
  dominantBars: number;
  longest: { key: Key; bars: number } | null;
}

export interface Stats {
  spans: Span[];
  keys: KeyStat[];
  distances: DistanceStat[];
  sections: SectionStat[];
  modulations: Modulation[];
  profile: ProfilePoint[];
  summary: Summary;
  centerRow: number;
  /** Number of distance classes used for sections (0..N-1, last = N-1 and further). */
  classes: number;
}

export const DISTANCE_CLASSES = 5;

const keyId = (k: Key) => `${k.fifths}:${k.mode}`;
const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** Sorted spans without overlaps (the earlier stretch wins) and without zero-length leftovers. */
export function buildSpans(piece: Piece): Span[] {
  const sorted = [...piece.segments].sort((a, b) => a.from - b.from || a.to - b.to);
  const spans: Span[] = [];
  let cursor = 0;
  for (const s of sorted) {
    const from = Math.max(s.from, cursor);
    if (s.to - from < 1e-9) continue;
    spans.push({ from, to: s.to, key: s.key, kind: s.kind });
    cursor = s.to;
  }
  return spans;
}

export function computeStats(piece: Piece): Stats {
  const centerRow = rowOf(piece.meta.center);
  const spans = buildSpans(piece);
  const pieceBars = lastBarOf(piece);
  const dist = (k: Key) => rowOf(k) - centerRow;
  const len = (s: Span) => s.to - s.from;
  const analysed = spans.reduce((n, s) => n + len(s), 0);
  const share = (n: number) => (analysed > 0 ? n / analysed : 0);

  // ---- per key ---------------------------------------------------------------------------------
  const byKey = new Map<string, KeyStat>();
  for (const s of spans) {
    const id = keyId(s.key);
    let st = byKey.get(id);
    if (!st) {
      const signed = dist(s.key);
      st = {
        key: s.key, row: rowOf(s.key), distance: Math.abs(signed), signed,
        bars: 0, established: 0, dominant: 0, share: 0, visits: 0, longest: 0, first: s.from,
      };
      byKey.set(id, st);
    }
    st.bars += len(s);
    if (s.kind === 'key') st.established += len(s);
    else st.dominant += len(s);
  }

  // Visits and longest stay come from established stretches only, merging consecutive ones in the same key.
  const established = spans.filter((s) => s.kind === 'key');
  const runs: { key: Key; from: number; bars: number }[] = [];
  for (const s of established) {
    const last = runs[runs.length - 1];
    if (last && keyId(last.key) === keyId(s.key)) last.bars += len(s);
    else runs.push({ key: s.key, from: s.from, bars: len(s) });
  }
  for (const r of runs) {
    const st = byKey.get(keyId(r.key))!;
    st.visits += 1;
    st.longest = Math.max(st.longest, r.bars);
  }
  const keys = [...byKey.values()].map((k) => ({ ...k, share: share(k.bars) }));
  keys.sort((a, b) => b.bars - a.bars || a.first - b.first);

  // ---- per distance --------------------------------------------------------------------------------
  const byDistance = new Map<number, DistanceStat>();
  for (const s of spans) {
    const d = dist(s.key);
    const st = byDistance.get(d) ?? { signed: d, major: 0, minor: 0, bars: 0, share: 0 };
    if (s.key.mode === 'major') st.major += len(s);
    else st.minor += len(s);
    st.bars += len(s);
    byDistance.set(d, st);
  }
  const signedValues = [...byDistance.keys(), 0];
  const lo = Math.min(...signedValues);
  const hi = Math.max(...signedValues);
  const distances: DistanceStat[] = [];
  for (let d = lo; d <= hi; d++) {
    const st = byDistance.get(d) ?? { signed: d, major: 0, minor: 0, bars: 0, share: 0 };
    distances.push({ ...st, share: share(st.bars) });
  }

  // ---- per section ---------------------------------------------------------------------------------------
  const sorted = [...piece.sections].sort((a, b) => a.from - b.from);
  const sectionAt = (pos: number) => {
    let name = '';
    for (const s of sorted) if (s.from <= pos + 1e-9) name = s.name;
    return name;
  };
  const sections: SectionStat[] = sorted.map((sec, i) => {
    const end = sorted[i + 1]?.from ?? pieceBars + 1;
    const clipped = spans
      .map((s) => ({ ...s, from: Math.max(s.from, sec.from), to: Math.min(s.to, end) }))
      .filter((s) => s.to - s.from > 1e-9);
    const bars = clipped.reduce((n, s) => n + len(s), 0);
    const classes = new Array<number>(DISTANCE_CLASSES).fill(0);
    let home = 0;
    let weighted = 0;
    let max = 0;
    const seen = new Set<string>();
    for (const s of clipped) {
      const d = Math.abs(dist(s.key));
      if (d === 0) home += len(s);
      weighted += d * len(s);
      max = Math.max(max, d);
      classes[Math.min(d, DISTANCE_CLASSES - 1)] += len(s);
      seen.add(keyId(s.key));
    }
    return {
      name: sec.name || `${sec.from}`,
      from: sec.from,
      to: end,
      bars,
      home,
      homeShare: bars > 0 ? home / bars : 0,
      meanDistance: bars > 0 ? weighted / bars : 0,
      maxDistance: max,
      keys: seen.size,
      byDistance: classes,
    };
  });

  // ---- modulations -----------------------------------------------------------------------------------------
  const modulations: Modulation[] = [];
  for (let i = 1; i < runs.length; i++) {
    const a = runs[i - 1];
    const b = runs[i];
    modulations.push({
      pos: b.from,
      from: a.key,
      to: b.key,
      step: rowOf(b.key) - rowOf(a.key),
      distanceAfter: Math.abs(dist(b.key)),
      section: sectionAt(b.from),
    });
  }

  // ---- distance over time -----------------------------------------------------------------------------------
  const profile: ProfilePoint[] = spans.map((s) => ({ from: s.from, to: s.to, signed: dist(s.key) }));

  // ---- summary ------------------------------------------------------------------------------------------------
  let weighted = 0;
  let farthest: Summary['farthest'] = null;
  let majorBars = 0;
  for (const s of spans) {
    const d = Math.abs(dist(s.key));
    weighted += d * len(s);
    if (!farthest || d > Math.abs(dist(farthest.key))) farthest = { key: s.key, pos: s.from };
    if (s.key.mode === 'major') majorBars += len(s);
  }
  const homeBars = spans.filter((s) => dist(s.key) === 0).reduce((n, s) => n + len(s), 0);
  const dominants = spans.filter((s) => s.kind === 'dominant');
  const longestRun = runs.reduce<{ key: Key; bars: number } | null>(
    (best, r) => (!best || r.bars > best.bars ? { key: r.key, bars: r.bars } : best),
    null,
  );
  const summary: Summary = {
    pieceBars,
    analysedBars: round(analysed),
    gapBars: round(Math.max(0, pieceBars - analysed)),
    distinctKeys: keys.length,
    modulations: modulations.length,
    maxDistance: farthest ? Math.abs(dist(farthest.key)) : 0,
    farthest,
    meanDistance: share(weighted),
    homeShare: share(homeBars),
    majorShare: share(majorBars),
    minorShare: share(analysed - majorBars),
    dominantCount: dominants.length,
    dominantBars: round(dominants.reduce((n, s) => n + len(s), 0)),
    longest: longestRun,
  };

  return { spans, keys, distances, sections, modulations, profile, summary, centerRow, classes: DISTANCE_CLASSES };
}
