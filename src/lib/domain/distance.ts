import { rowOf } from './keys';
import type { Key, Mode } from './types';

/**
 * How far two keys are apart.
 *
 * - `rows`:  fifths between the rows of the chart. Relative keys (Es-Dur / c-Moll) share a row, so
 *            they are 0 apart; c-Moll and C-Dur (same tonic) are 3 apart. This is what the chart draws.
 * - `tonic`: fifths between the tonics, ignoring the mode. c-Moll and C-Dur are 0 apart,
 *            c-Moll and Es-Dur are 3 apart.
 * - `steps`: the fewest moves along the relations fifth up/down (same mode), relative key and
 *            same-tonic key (variant), each counting 1 (in the spirit of Weber's chart of key relations).
 */
export type DistanceMeasure = 'rows' | 'tonic' | 'steps';

export const DISTANCE_MEASURES: DistanceMeasure[] = ['rows', 'tonic', 'steps'];

export interface KeyDistance {
  /** Absolute distance, in the unit of the measure. */
  distance: number;
  /** Positive towards the sharp side; 0 for distance 0. */
  signed: number;
}

const LIMIT = 24;
const cache = new Map<Mode, Map<string, number>>();

/** Shortest number of relation steps from (0, mode) to every key within the search window. */
function stepTable(from: Mode): Map<string, number> {
  const hit = cache.get(from);
  if (hit) return hit;
  const dist = new Map<string, number>();
  const id = (f: number, m: Mode) => `${f}:${m}`;
  dist.set(id(0, from), 0);
  let frontier: [number, Mode][] = [[0, from]];
  while (frontier.length > 0) {
    const next: [number, Mode][] = [];
    for (const [f, m] of frontier) {
      const d = dist.get(id(f, m))!;
      const neighbours: [number, Mode][] = [
        [f + 1, m],
        [f - 1, m],
        [f, m === 'major' ? 'minor' : 'major'],
        m === 'major' ? [f + 3, 'minor'] : [f - 3, 'major'],
      ];
      for (const [nf, nm] of neighbours) {
        if (Math.abs(nf) > LIMIT || dist.has(id(nf, nm))) continue;
        dist.set(id(nf, nm), d + 1);
        next.push([nf, nm]);
      }
    }
    frontier = next;
  }
  cache.set(from, dist);
  return dist;
}

export function keyDistance(a: Key, b: Key, measure: DistanceMeasure): KeyDistance {
  if (measure === 'rows') {
    const signed = rowOf(b) - rowOf(a);
    return { distance: Math.abs(signed), signed };
  }
  const tonicDiff = b.fifths - a.fifths;
  if (measure === 'tonic') return { distance: Math.abs(tonicDiff), signed: tonicDiff };
  const d = stepTable(a.mode).get(`${tonicDiff}:${b.mode}`) ?? Math.abs(tonicDiff);
  const side = tonicDiff !== 0 ? Math.sign(tonicDiff) : Math.sign(rowOf(b) - rowOf(a));
  return { distance: d, signed: d === 0 ? 0 : (side || 1) * d };
}

export const sameKeyExactly = (a: Key, b: Key) => a.fifths === b.fifths && a.mode === b.mode;
