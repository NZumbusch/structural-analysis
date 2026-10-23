import { describe, expect, it } from 'vitest';
import { keyDistance, type DistanceMeasure } from '../domain/distance';
import { parseKey, rowOf } from '../domain/keys';
import { createPiece } from '../domain/piece';
import { makeEvent } from '../domain/structure';
import type { Key, Piece } from '../domain/types';
import { computeStats } from './stats';

const K = (s: string, names: 'de' | 'en' = 'de'): Key => parseKey(s, names)!;

describe('distance measures: hand-computed pairs (home key first)', () => {
  // [home, other, rows, tonic, steps]
  const table: [string, string, number, number, number][] = [
    ['C', 'a', 0, 3, 1], // relative keys share a row; tonics three fifths apart; one relation step
    ['C', 'c', -3, 0, 1], // same tonic: three rows apart (c minor sits in the E-flat row), tonics equal, one variant step
    ['C', 'G', 1, 1, 1],
    ['C', 'F', -1, -1, 1],
    ['C', 'e', 1, 4, 2], // e minor is the relative of G: two steps
    ['C', 'Es', -3, -3, 2], // C -> c -> Es
    ['C', 'Des', -5, -5, 4], // C -> c -> Es -> As -> Des
    ['c', 'Es', 0, -3, 1],
    ['c', 'g', 1, 1, 1],
  ];

  it.each(table)('%s -> %s', (home, other, rows, tonic, steps) => {
    const h = K(home);
    const o = K(other);
    expect(keyDistance(h, o, 'rows').signed).toBe(rows);
    expect(keyDistance(h, o, 'tonic').signed).toBe(tonic);
    expect(keyDistance(h, o, 'steps').distance).toBe(steps);
  });

  it('as-Moll against c-Moll (the Haydn example): four rows below the home row', () => {
    expect(keyDistance(K('c'), K('as'), 'rows').signed).toBe(-4);
  });

  it('is symmetric in absolute value for every measure', () => {
    const keys: Key[] = [];
    for (let f = -7; f <= 7; f++) for (const mode of ['major', 'minor'] as const) keys.push({ fifths: f, mode });
    for (const m of ['rows', 'tonic', 'steps'] as DistanceMeasure[])
      for (const a of keys) for (const b of keys) expect(keyDistance(a, b, m).distance).toBe(keyDistance(b, a, m).distance);
  });
});

describe('key names', () => {
  it('knows the standard spellings', () => {
    expect(K('Es')).toEqual({ fifths: -3, mode: 'major' });
    expect(K('B')).toEqual({ fifths: -2, mode: 'major' }); // German B = B-flat
    expect(K('H')).toEqual({ fifths: 5, mode: 'major' });
    expect(K('B', 'en')).toEqual({ fifths: 5, mode: 'major' });
    expect(K('Bb', 'en')).toEqual({ fifths: -2, mode: 'major' });
    expect(K('fis')).toEqual({ fifths: 6 + 0, mode: 'minor' });
    expect(K('A-Dur')).toEqual({ fifths: 3, mode: 'major' });
    expect(K('F# minor', 'en')).toEqual({ fifths: 6, mode: 'minor' });
    expect(K('Cm')).toEqual({ fifths: 0, mode: 'minor' });
    expect(rowOf(K('c'))).toBe(-3);
  });
});

/** Tiny deterministic generator so the property test is reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

/** Reference implementation: walk the piece in quarter-bar steps and count what is sounding. Shares no code with computeStats. */
function reference(p: Piece, measure: DistanceMeasure) {
  const step = 0.25;
  const home = p.meta.center;
  const end = Math.max(...p.segments.map((s) => s.to));
  const time = new Map<string, number>();
  let analysed = 0;
  let distSum = 0;
  let majorTime = 0;
  let homeTime = 0;
  let prevEstablished: string | null = null;
  let modulations = 0;
  for (let t = 1 + step / 2; t < end; t += step) {
    // earlier-starting stretch wins on overlap
    const here = [...p.segments].sort((a, b) => a.from - b.from || a.to - b.to).find((s) => s.from <= t && t < s.to);
    if (!here) continue;
    const id = `${here.key.fifths}:${here.key.mode}`;
    time.set(id, (time.get(id) ?? 0) + step);
    analysed += step;
    const d = Math.abs(keyDistance(home, here.key, measure).signed);
    distSum += d * step;
    if (here.key.mode === 'major') majorTime += step;
    if (d === 0) homeTime += step;
    if (here.kind === 'key') {
      if (prevEstablished !== null && prevEstablished !== id) modulations++;
      prevEstablished = id;
    }
  }
  return { time, analysed, mean: analysed ? distSum / analysed : 0, majorShare: analysed ? majorTime / analysed : 0, homeShare: analysed ? homeTime / analysed : 0, modulations };
}

describe('statistics agree with an independent sampling reference on random pieces', () => {
  for (const measure of ['rows', 'tonic', 'steps'] as DistanceMeasure[]) {
    it(`measure ${measure}`, () => {
      const rand = rng(12345);
      for (let n = 0; n < 60; n++) {
        const p = createPiece();
        p.meta.center = { fifths: Math.floor(rand() * 7) - 3, mode: rand() < 0.5 ? 'major' : 'minor' };
        p.meta.distanceMeasure = measure;
        const count = 1 + Math.floor(rand() * 12);
        for (let i = 0; i < count; i++) {
          const from = 1 + Math.floor(rand() * 40) / 2; // halves of bars
          const to = from + 0.5 + Math.floor(rand() * 20) / 2;
          p.segments.push({
            id: `s${i}`,
            from,
            to,
            key: { fifths: Math.floor(rand() * 11) - 5, mode: rand() < 0.5 ? 'major' : 'minor' },
            kind: rand() < 0.2 ? 'dominant' : 'key',
            label: '',
          });
        }
        p.meta.lastBar = Math.ceil(Math.max(...p.segments.map((s) => s.to)));
        const ref = reference(p, measure);
        const got = computeStats(p);
        expect(got.summary.analysedBars).toBeCloseTo(ref.analysed, 6);
        expect(got.summary.meanDistance).toBeCloseTo(ref.mean, 6);
        expect(got.summary.majorShare).toBeCloseTo(ref.majorShare, 6);
        expect(got.summary.homeShare).toBeCloseTo(ref.homeShare, 6);
        expect(got.summary.modulations).toBe(ref.modulations);
        for (const k of got.keys) expect(k.bars).toBeCloseTo(ref.time.get(`${k.key.fifths}:${k.key.mode}`) ?? 0, 6);
        expect(got.keys.length).toBe(ref.time.size);
      }
    });
  }
});

describe('repeats in the statistics', () => {
  it('counts a repeated passage once by default and twice in play order', () => {
    const p = createPiece();
    p.meta.center = K('C');
    p.segments = [
      { id: 'a', from: 1, to: 9, key: K('C'), kind: 'key', label: '' },
      { id: 'b', from: 9, to: 13, key: K('G'), kind: 'key', label: '' },
    ];
    p.meta.lastBar = 12;
    p.events.push(makeEvent('repeat-start', 1), makeEvent('repeat-end', 9, { times: 2 }));
    const once = computeStats(p);
    expect(once.summary.analysedBars).toBe(12);
    expect(once.summary.homeShare).toBeCloseTo(8 / 12);
    const played = computeStats(p, { countRepeats: true });
    expect(played.summary.analysedBars).toBe(20);
    expect(played.summary.homeShare).toBeCloseTo(16 / 20);
    // C (twice, merged into one run across the repeat) -> G: still one modulation
    expect(played.summary.modulations).toBe(1);
  });
});
