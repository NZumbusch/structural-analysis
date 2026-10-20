import { sameKey } from './keys';
import type { Piece, Segment } from './types';

const EPS = 1e-9;

/**
 * The key path without tonicisations: each one is absorbed by the key stretch before it (the key you are
 * leaving, until the new key really begins). A tonicisation at the very start joins the key that follows.
 * Neighbouring stretches of the same key (without text of their own) become one.
 */
export function foldSegments(segments: Segment[]): Segment[] {
  const sorted = [...segments].sort((a, b) => a.from - b.from || a.to - b.to);
  const out: Segment[] = [];
  let leadFrom: number | null = null;
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (s.kind !== 'key') {
      if (last && s.from <= last.to + EPS) last.to = Math.max(last.to, s.to);
      else if (!last) leadFrom = leadFrom ?? s.from;
      continue;
    }
    const from = leadFrom !== null ? Math.min(leadFrom, s.from) : s.from;
    leadFrom = null;
    if (last && sameKey(last.key, s.key) && !last.label && !s.label && from <= last.to + EPS) last.to = Math.max(last.to, s.to);
    else out.push({ ...s, from });
  }
  return out;
}

/** The piece as it is drawn and counted: with tonicisations folded into their keys when the style asks for it. */
export function folded(piece: Piece): Piece {
  return piece.style.foldTonicizations ? { ...piece, segments: foldSegments(piece.segments) } : piece;
}
