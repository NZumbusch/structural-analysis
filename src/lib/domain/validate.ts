import { endPos, lastBarOf, startPos } from './structure';
import type { Piece, Segment } from './types';

export type Severity = 'error' | 'warning' | 'info';

export type FixKind =
  | 'trim-overlap'
  | 'close-gap'
  | 'extend-start'
  | 'extend-end'
  | 'delete'
  | 'extend-bars'
  | 'round-pos'
  | 'move-to-start';

export type TargetKind = 'segment' | 'passing' | 'annotation' | 'event' | 'view';

export interface Issue {
  /** Stable for the same problem, so lists do not flicker while editing. */
  id: string;
  severity: Severity;
  /** Message key; the UI looks up `val.<code>`. */
  code: string;
  /** Bar to show the problem at. */
  pos: number;
  params: Record<string, string | number>;
  target?: { kind: TargetKind; id: string };
  fix?: { kind: FixKind; value?: number };
}

const EPS = 1e-6;
const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

/** Checks the analysis for things that would silently change the picture or the statistics. */
export function validate(piece: Piece): Issue[] {
  const issues: Issue[] = [];
  const start = startPos(piece);
  const bars = lastBarOf(piece);
  const end = endPos(piece);
  const fixedLength = !!piece.meta.lastBar;
  const add = (i: Omit<Issue, 'id'> & { id?: string }) =>
    issues.push({ ...i, id: i.id ?? `${i.code}:${i.target?.id ?? fmt(i.pos)}` });

  // ---- stretches of music ------------------------------------------------------------------------
  const valid: Segment[] = [];
  for (const s of piece.segments) {
    const target = { kind: 'segment' as const, id: s.id };
    if (s.to - s.from <= EPS) {
      add({ severity: 'error', code: 'empty-segment', pos: s.from, params: { pos: fmt(s.from) }, target, fix: { kind: 'delete' } });
      continue;
    }
    valid.push(s);
    if (s.from < start - EPS) {
      add({ severity: 'error', code: 'before-start', pos: s.from, params: { pos: fmt(s.from) }, target, fix: { kind: 'move-to-start' } });
    }
    if (fixedLength && s.to > bars + 1 + EPS) {
      add({ severity: 'warning', code: 'beyond-end', pos: s.to, params: { to: fmt(s.to), bars }, target, fix: { kind: 'extend-bars', value: Math.ceil(s.to - EPS) - 1 } });
    }
  }

  const sorted = [...valid].sort((a, b) => a.from - b.from || a.to - b.to);
  const passingIn = (from: number, to: number) => piece.passing.some((p) => p.pos >= from - EPS && p.pos < to + EPS);
  let reach: Segment | null = null; // the segment that reaches furthest so far
  for (const s of sorted) {
    if (reach) {
      if (reach.to > s.from + EPS) {
        add({
          severity: 'warning', code: 'overlap', pos: s.from,
          params: { pos: fmt(s.from), a: `${fmt(reach.from)}–${fmt(reach.to)}`, b: `${fmt(s.from)}–${fmt(s.to)}` },
          target: { kind: 'segment', id: s.id },
          fix: reach.from < s.from - EPS ? { kind: 'trim-overlap' } : undefined,
        });
      } else if (s.from > reach.to + EPS) {
        const withPassing = passingIn(reach.to, s.from);
        add({
          severity: withPassing ? 'info' : 'warning', code: withPassing ? 'gap-passing' : 'gap', pos: reach.to,
          params: { pos: fmt(reach.to), to: fmt(s.from) },
          target: { kind: 'segment', id: s.id },
          fix: withPassing ? undefined : { kind: 'close-gap' },
        });
      }
      if (s.to > reach.to) reach = s;
    } else {
      reach = s;
      if (s.from > start + EPS) {
        const withPassing = passingIn(start, s.from);
        add({
          severity: withPassing ? 'info' : 'warning', code: 'gap-start', pos: start, params: { pos: fmt(s.from) },
          target: { kind: 'segment', id: s.id }, fix: withPassing ? undefined : { kind: 'extend-start' },
        });
      }
    }
  }
  if (reach && fixedLength && reach.to < end - EPS) {
    add({
      severity: 'info', code: 'gap-end', pos: reach.to, params: { pos: fmt(reach.to), bars },
      target: { kind: 'segment', id: reach.id }, fix: { kind: 'extend-end' },
    });
  }

  // ---- single items ------------------------------------------------------------------------------------
  for (const p of piece.passing) {
    const target = { kind: 'passing' as const, id: p.id };
    if (p.pos < start - EPS) add({ severity: 'warning', code: 'passing-before-start', pos: p.pos, params: { pos: fmt(p.pos) }, target, fix: { kind: 'delete' } });
    else if (fixedLength && p.pos > bars + 1 + EPS) add({ severity: 'warning', code: 'passing-beyond-end', pos: p.pos, params: { pos: fmt(p.pos), bars }, target, fix: { kind: 'extend-bars', value: Math.floor(p.pos) } });
  }
  for (const a of piece.annotations) {
    const target = { kind: 'annotation' as const, id: a.id };
    if (a.pos < start - EPS) add({ severity: 'warning', code: 'annotation-before-start', pos: a.pos, params: { pos: fmt(a.pos) }, target, fix: { kind: 'delete' } });
    else if (fixedLength && a.pos > bars + 1 + EPS) add({ severity: 'warning', code: 'annotation-beyond-end', pos: a.pos, params: { pos: fmt(a.pos), bars }, target, fix: { kind: 'extend-bars', value: Math.floor(a.pos) } });
  }
  for (const v of piece.views) {
    if (v.to - v.from <= EPS) add({ severity: 'error', code: 'view-empty', pos: v.from, params: { name: v.name }, target: { kind: 'view', id: v.id }, fix: { kind: 'delete' } });
  }

  // ---- structure events ----------------------------------------------------------------------------------------
  const events = [...piece.events].sort((a, b) => a.pos - b.pos);
  const repeatEnds = events.filter((e) => e.kind === 'repeat-end');
  const seen = new Map<string, string>();
  for (const e of events) {
    const target = { kind: 'event' as const, id: e.id };
    if (fixedLength && e.pos > bars + 1 + EPS && e.kind !== 'volta') {
      add({ severity: 'warning', code: 'event-beyond-end', pos: e.pos, params: { pos: fmt(e.pos), bars, kind: e.kind }, target, fix: { kind: 'extend-bars', value: Math.floor(e.pos) } });
    }
    if (e.kind === 'meter' && Math.abs(e.pos - Math.round(e.pos)) > EPS) {
      add({ severity: 'warning', code: 'meter-not-on-bar', pos: e.pos, params: { pos: fmt(e.pos) }, target, fix: { kind: 'round-pos' } });
    }
    if (e.kind === 'repeat-start' && !repeatEnds.some((r) => r.pos > e.pos + EPS)) {
      add({ severity: 'warning', code: 'repeat-start-orphan', pos: e.pos, params: { pos: fmt(e.pos) }, target, fix: { kind: 'delete' } });
    }
    if (e.kind === 'repeat-end') {
      const hasStart = events.some((s) => s.kind === 'repeat-start' && s.pos < e.pos - EPS);
      const earlierEnd = repeatEnds.some((r) => r.pos < e.pos - EPS);
      if (!hasStart && !earlierEnd && e.pos > start + EPS) add({ severity: 'info', code: 'repeat-end-from-start', pos: e.pos, params: { pos: fmt(e.pos) }, target });
    }
    if (e.kind === 'volta') {
      if (e.to - e.pos <= EPS) add({ severity: 'error', code: 'volta-empty', pos: e.pos, params: { pos: fmt(e.pos) }, target, fix: { kind: 'delete' } });
      else if (!repeatEnds.some((r) => Math.abs(r.pos - e.to) < EPS || Math.abs(r.pos - e.pos) < EPS)) {
        add({ severity: 'info', code: 'volta-no-repeat', pos: e.pos, params: { pos: fmt(e.pos) }, target });
      }
    }
    if (['meter', 'section', 'subsection', 'keysig'].includes(e.kind)) {
      const key = `${e.kind}:${fmt(e.pos)}`;
      if (seen.has(key)) add({ severity: 'warning', code: 'duplicate-event', pos: e.pos, params: { pos: fmt(e.pos), kind: e.kind }, target, fix: { kind: 'delete' } });
      else seen.set(key, e.id);
    }
  }

  const order = { error: 0, warning: 1, info: 2 } as const;
  return issues.sort((a, b) => order[a.severity] - order[b.severity] || a.pos - b.pos);
}

/** Applies the fix of an issue. Returns false when its target no longer exists. */
export function applyFix(piece: Piece, issue: Issue): boolean {
  const fix = issue.fix;
  if (!fix) return false;
  const t = issue.target;
  const seg = t?.kind === 'segment' ? piece.segments.find((s) => s.id === t.id) : undefined;
  const sortedSegs = () => [...piece.segments].filter((s) => s.to - s.from > EPS).sort((a, b) => a.from - b.from || a.to - b.to);

  switch (fix.kind) {
    case 'delete': {
      if (!t) return false;
      const lists = { segment: piece.segments, passing: piece.passing, annotation: piece.annotations, event: piece.events, view: piece.views } as const;
      const list = lists[t.kind] as { id: string }[];
      const i = list.findIndex((x) => x.id === t.id);
      if (i < 0) return false;
      list.splice(i, 1);
      return true;
    }
    case 'trim-overlap': {
      if (!seg) return false;
      const before = sortedSegs().filter((s) => s.id !== seg.id && s.from < seg.from - EPS && s.to > seg.from + EPS);
      for (const s of before) s.to = seg.from;
      return before.length > 0;
    }
    case 'close-gap': {
      if (!seg) return false;
      const prev = sortedSegs().filter((s) => s.id !== seg.id && s.to <= seg.from + EPS).pop();
      if (!prev) return false;
      prev.to = seg.from;
      return true;
    }
    case 'extend-start':
      if (!seg) return false;
      seg.from = startPos(piece);
      return true;
    case 'extend-end': {
      if (!seg) return false;
      seg.to = endPos(piece);
      return true;
    }
    case 'extend-bars':
      if (!fix.value) return false;
      piece.meta.lastBar = Math.max(piece.meta.lastBar ?? 0, fix.value);
      return true;
    case 'round-pos': {
      const e = t ? piece.events.find((x) => x.id === t.id) : undefined;
      if (!e) return false;
      e.pos = Math.max(1, Math.round(e.pos));
      return true;
    }
    case 'move-to-start':
      if (!seg) return false;
      seg.from = startPos(piece);
      return true;
  }
}

/** Applies every available fix of errors and warnings (info hints are left alone). Returns how many were applied. */
export function applyAllFixes(piece: Piece): number {
  let applied = 0;
  const tried = new Set<string>();
  for (let guard = 0; guard < 200; guard++) {
    const next = validate(piece).find((i) => i.fix && i.severity !== 'info' && !tried.has(i.id));
    if (!next) break;
    tried.add(next.id);
    if (applyFix(piece, next)) applied++;
  }
  return applied;
}
