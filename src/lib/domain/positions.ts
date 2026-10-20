import type { Meter } from './types';

export const DEFAULT_METER: Meter = { beats: 4, unit: 4 };

/** Time signature as it changes through the piece. */
export interface MeterMap {
  at(pos: number): Meter;
}
export type MeterSource = Meter | MeterMap;

export function meterAt(src: MeterSource, pos: number): Meter {
  return 'at' in src ? src.at(pos) : src;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Parses a position inside the piece. Accepted: '74' (bar 74), '74.5' (decimal bar),
 * '74:3' (bar 74, beat 3), '74:2.5' (the "and" of beat 2), '0:4' (beat 4 of an anacrusis bar 0).
 * Beats are counted in the meter that is valid in that bar. Returns bars as a fraction, or null.
 */
export function parsePos(text: string, src: MeterSource = DEFAULT_METER): number | null {
  const s = text.trim().replace(',', '.');
  const beat = s.match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (beat) {
    const bar = parseInt(beat[1], 10);
    const b = parseFloat(beat[2]);
    const meter = meterAt(src, bar);
    if (b < 1 || b >= meter.beats + 1) return null;
    return bar + (b - 1) / meter.beats;
  }
  return /^\d+(\.\d+)?$/.test(s) ? parseFloat(s) : null;
}

/** Inverse of parsePos: whole bars as '74', otherwise 'bar:beat'. */
export function formatPos(pos: number, src: MeterSource = DEFAULT_METER): string {
  let bar = Math.floor(pos + 1e-9);
  const frac = pos - bar;
  if (frac < 1e-6) return String(bar);
  const meter = meterAt(src, bar);
  const beat = round3(frac * meter.beats + 1);
  if (beat >= meter.beats + 1) bar += 1;
  return beat === 1 || beat >= meter.beats + 1 ? String(bar) : `${bar}:${beat}`;
}

/** Snap granularity in bars for the editor grid. */
export type Snap = 'bar' | 'beat' | 'half';

export function snapUnit(snap: Snap, meter: Meter): number {
  return snap === 'bar' ? 1 : snap === 'beat' ? 1 / meter.beats : 1 / (2 * meter.beats);
}

export function snapPos(pos: number, snap: Snap, src: MeterSource, min = 0): number {
  const u = snapUnit(snap, meterAt(src, Math.floor(pos)));
  return Math.max(min, Math.round(pos / u) * u);
}

/** 'Takt 70–80' style range for a view with exclusive end. */
export function barRange(from: number, to: number): [number, number] {
  return [Math.floor(from + 1e-9), Math.max(Math.floor(from + 1e-9), Math.ceil(to - 1e-9) - 1)];
}
