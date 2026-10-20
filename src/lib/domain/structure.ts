import { newId } from './ids';
import { DEFAULT_METER, type MeterMap } from './positions';
import type { EventKind, Highlight, Meter, Piece, StructEvent } from './types';

const EPS = 1e-9;

export function makeEvent(kind: EventKind, pos: number, extra: Partial<StructEvent> = {}): StructEvent {
  return {
    id: newId(), kind, pos,
    beats: 4, unit: 4, times: 2, to: pos + 1, numbers: [1],
    name: '', shade: false, label: '', line: true, style: 'double', fifths: 0,
    ...extra,
  };
}

/** Events in the order they appear (stable for equal positions). */
export function sortedEvents(piece: Piece, kind?: EventKind): StructEvent[] {
  return piece.events
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => !kind || e.kind === kind)
    .sort((a, b) => a.e.pos - b.e.pos || a.i - b.i)
    .map(({ e }) => e);
}

/** The time signature valid at each position: the default one, then every meter event in turn. */
export function meterMap(piece: Piece): MeterMap {
  const changes = sortedEvents(piece, 'meter');
  const base: Meter = piece.meta.meter?.beats >= 1 ? piece.meta.meter : DEFAULT_METER;
  return {
    at(pos: number) {
      let m = base;
      for (const e of changes) {
        if (e.pos <= pos + EPS) m = { beats: e.beats, unit: e.unit };
        else break;
      }
      return m;
    },
  };
}

/** Where the chart starts: bar 1, or earlier by the length of an anacrusis. */
export function startPos(piece: Piece): number {
  const pickup = piece.meta.pickup ?? 0;
  if (pickup <= 0) return 1;
  const beats = meterMap(piece).at(1).beats;
  return 1 - Math.min(pickup, beats - 0.25) / beats;
}

/** The last bar of the piece: the set number of bars, or (if none is set) the end of the content. */
export function lastBarOf(piece: Piece): number {
  if (piece.meta.lastBar && piece.meta.lastBar >= 1) return Math.floor(piece.meta.lastBar);
  const ends = [
    ...piece.segments.map((s) => s.to - 1),
    ...piece.passing.map((p) => Math.floor(p.pos)),
    ...piece.highlights.map((h) => h.to),
    ...piece.events.filter((e) => e.kind !== 'volta').map((e) => Math.floor(e.pos)),
  ];
  return Math.max(8, Math.ceil(Math.max(0, ...ends)));
}

/** End of what is drawn (exclusive): the set bars, but never cutting off analysed material. */
export function endPos(piece: Piece): number {
  const content = Math.max(0, ...piece.segments.map((s) => s.to));
  return Math.max(lastBarOf(piece) + 1, content);
}

// ---- sections -----------------------------------------------------------------------------------------

export interface SubSpan {
  id: string;
  name: string;
  from: number;
  to: number;
}

export interface SectionSpan {
  id: string;
  name: string;
  from: number;
  to: number;
  shade: boolean;
  subs: SubSpan[];
}

/**
 * Main parts (Exposition, 1. Durchführung, 2. Durchführung …), each running to the next one,
 * with their sub-parts (Thema 1, Überleitung …) inside. Sub-parts before the first main part
 * belong to an unnamed part that starts with the piece.
 */
export function sectionSpans(piece: Piece): SectionSpan[] {
  const end = endPos(piece);
  const mains = sortedEvents(piece, 'section');
  const subs = sortedEvents(piece, 'subsection');
  const start = startPos(piece);
  const spans: SectionSpan[] = mains.map((m, i) => ({
    id: m.id, name: m.name, from: m.pos, to: mains[i + 1]?.pos ?? end, shade: m.shade, subs: [],
  }));
  if (subs.length > 0 && (spans.length === 0 || subs[0].pos < spans[0].from - EPS)) {
    spans.unshift({ id: '', name: '', from: start, to: spans[0]?.from ?? end, shade: false, subs: [] });
  }
  subs.forEach((s, i) => {
    const owner = [...spans].reverse().find((sp) => sp.from <= s.pos + EPS);
    if (!owner) return;
    const next = subs.find((n, j) => j > i && n.pos > s.pos + EPS);
    owner.subs.push({ id: s.id, name: s.name, from: s.pos, to: Math.min(next?.pos ?? owner.to, owner.to) });
  });
  return spans;
}

// ---- editing the number of bars --------------------------------------------------------------------------

/** Shifts everything at or after bar `at` by `count` bars; stretches what straddles it. */
export function insertBars(piece: Piece, at: number, count: number): void {
  if (count <= 0) return;
  const pos = (p: number) => (p >= at - EPS ? p + count : p);
  const end = (p: number) => (p > at + EPS ? p + count : p);
  for (const s of piece.segments) {
    s.from = pos(s.from);
    s.to = end(s.to);
  }
  for (const p of piece.passing) p.pos = pos(p.pos);
  for (const a of piece.annotations) a.pos = pos(a.pos);
  for (const v of piece.views) {
    v.from = pos(v.from);
    v.to = end(v.to);
  }
  for (const h of piece.highlights) {
    if (h.from >= at) h.from += count;
    if (h.to >= at) h.to += count;
  }
  for (const e of piece.events) {
    e.pos = pos(e.pos);
    if (e.kind === 'volta') e.to = end(e.to);
  }
  if (piece.meta.lastBar) piece.meta.lastBar += count;
}

/** Removes bars [at, at+count): later material moves up, material inside is trimmed or dropped. */
export function deleteBars(piece: Piece, at: number, count: number): void {
  if (count <= 0) return;
  const cut = at + count;
  const m = (p: number) => (p <= at + EPS ? p : p >= cut - EPS ? p - count : at);
  const inside = (p: number) => p >= at - EPS && p < cut - EPS;

  piece.segments = piece.segments
    .map((s) => ({ ...s, from: m(s.from), to: m(s.to) }))
    .filter((s) => s.to - s.from > EPS);
  piece.passing = piece.passing.filter((p) => !inside(p.pos)).map((p) => ({ ...p, pos: m(p.pos) }));
  piece.annotations = piece.annotations.filter((a) => !inside(a.pos)).map((a) => ({ ...a, pos: m(a.pos) }));
  piece.views = piece.views
    .map((v) => ({ ...v, from: m(v.from), to: m(v.to) }))
    .filter((v) => v.to - v.from > EPS);
  piece.highlights = piece.highlights
    .map((h): Highlight => ({ ...h, from: m(h.from), to: m(h.to + 1) - 1 }))
    .filter((h) => h.to >= h.from);

  // Region-like events (meter, key signature, sections) survive by moving to the cut; point events inside go.
  const keep: StructEvent[] = [];
  for (const e of piece.events) {
    if (e.kind === 'volta') {
      const from = m(e.pos);
      const to = m(e.to);
      if (to - from > EPS) keep.push({ ...e, pos: from, to });
    } else if (inside(e.pos) && !['meter', 'keysig', 'section', 'subsection'].includes(e.kind)) {
      continue;
    } else {
      keep.push({ ...e, pos: m(e.pos) });
    }
  }
  piece.events = keep;
  if (piece.meta.lastBar) piece.meta.lastBar = Math.max(1, piece.meta.lastBar - count);
}

// ---- play order (repeats) ----------------------------------------------------------------------------------

export interface Interval {
  from: number;
  to: number;
}

/** The notation positions in the order they are played, following repeats and numbered endings. */
export function playIntervals(piece: Piece): Interval[] {
  const start = startPos(piece);
  const end = endPos(piece);
  const repeatEnds = sortedEvents(piece, 'repeat-end');
  const repeatStarts = sortedEvents(piece, 'repeat-start');
  const voltas = sortedEvents(piece, 'volta');
  const out: Interval[] = [];

  const push = (from: number, to: number) => {
    if (to - from <= EPS) return;
    out.push({ from, to });
  };
  /** [from,to) without the endings that are not played in pass k. */
  const pushPass = (from: number, to: number, k: number) => {
    const skipped = voltas
      .filter((v) => v.pos >= from - EPS && v.to <= to + EPS && !v.numbers.includes(k))
      .sort((a, b) => a.pos - b.pos);
    let cur = from;
    for (const v of skipped) {
      push(cur, v.pos);
      cur = Math.max(cur, v.to);
    }
    push(cur, to);
  };

  let cursor = start;
  for (const re of repeatEnds) {
    if (re.pos <= cursor + EPS || re.pos > end + EPS) continue;
    const s = [...repeatStarts].reverse().find((r) => r.pos < re.pos - EPS && r.pos >= cursor - EPS)?.pos ?? cursor;
    push(cursor, s);
    const times = Math.max(1, Math.round(re.times));
    for (let k = 1; k <= times; k++) pushPass(s, re.pos, k);
    cursor = re.pos;
    // endings after the repeat sign that are not for the last pass are skipped
    let moved = true;
    while (moved) {
      moved = false;
      for (const v of voltas) {
        if (Math.abs(v.pos - cursor) < EPS && !v.numbers.includes(times)) {
          cursor = v.to;
          moved = true;
        }
      }
    }
  }
  push(cursor, end);
  return out;
}

export interface Expanded {
  piece: Piece;
  /** Label for the bar axis: the notated bar number at a play position. */
  labelOf: (playBar: number) => string;
  intervals: Interval[];
  /** Play positions where the music jumps (back to a repeat start or past an ending). */
  jumps: number[];
}

/**
 * The piece laid out in play order: repeated passages appear again and numbered endings only in the
 * passes they belong to. Repeat signs and endings are dropped (they are what got expanded).
 */
export function expandPlayOrder(piece: Piece): Expanded {
  const intervals = playIntervals(piece);
  const start = startPos(piece);
  let offset = start;
  const mapped = intervals.map((iv) => {
    const m = { ...iv, play: offset };
    offset += iv.to - iv.from;
    return m;
  });
  const total = offset;
  const first = (pos: number): number => {
    const hit = mapped.find((iv) => pos >= iv.from - EPS && pos < iv.to - EPS);
    if (hit) return hit.play + (pos - hit.from);
    const next = mapped.find((iv) => iv.from >= pos - EPS);
    return next ? next.play : total;
  };
  const range = <T extends { id: string }>(item: T, from: number, to: number, set: (c: T, f: number, t: number) => void): T[] => {
    const res: T[] = [];
    let n = 0;
    for (const iv of mapped) {
      const a = Math.max(from, iv.from);
      const b = Math.min(to, iv.to);
      if (b - a <= EPS) continue;
      const clone = { ...item, id: n === 0 ? item.id : `${item.id}~${n}` };
      set(clone, iv.play + (a - iv.from), iv.play + (b - iv.from));
      res.push(clone);
      n++;
    }
    return res;
  };

  const out: Piece = JSON.parse(JSON.stringify(piece));
  out.segments = piece.segments.flatMap((s) => range(s, s.from, s.to, (c, f, t) => ((c.from = f), (c.to = t))));
  out.segments.sort((a, b) => a.from - b.from || a.to - b.to);
  out.passing = piece.passing.flatMap((p) => {
    const res: typeof piece.passing = [];
    mapped.forEach((iv, i) => {
      if (p.pos >= iv.from - EPS && p.pos < iv.to - EPS) res.push({ ...p, id: i === 0 ? p.id : `${p.id}~${i}`, pos: iv.play + (p.pos - iv.from) });
    });
    return res;
  });
  out.annotations = piece.annotations.map((a) => ({ ...a, pos: first(a.pos) }));
  out.highlights = piece.highlights.flatMap((h) =>
    range(h, h.from, h.to + 1, (c, f, t) => ((c.from = Math.floor(f + EPS)), (c.to = Math.max(c.from, Math.ceil(t - EPS) - 1)))),
  );
  out.views = piece.views.map((v) => ({ ...v, from: first(v.from), to: first(v.to) }));
  out.events = piece.events
    .filter((e) => !['repeat-start', 'repeat-end', 'volta'].includes(e.kind))
    .map((e) => ({ ...e, pos: first(e.pos) }));
  out.meta.lastBar = Math.max(1, Math.ceil(total - EPS) - 1);

  const labelOf = (playBar: number) => {
    const iv = mapped.find((m) => playBar >= m.play - EPS && playBar < m.play + (m.to - m.from) - EPS);
    return String(iv ? Math.floor(iv.from + (playBar - iv.play) + EPS) : Math.round(playBar));
  };
  const jumps = mapped.filter((m, i) => i > 0 && Math.abs(m.from - mapped[i - 1].to) > EPS).map((m) => m.play);
  return { piece: out, labelOf, intervals, jumps };
}

export const hasRepeats = (piece: Piece) => piece.events.some((e) => e.kind === 'repeat-end');
