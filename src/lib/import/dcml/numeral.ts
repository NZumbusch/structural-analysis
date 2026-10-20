import { parseKey } from '../../domain/keys';
import type { Key, Mode } from '../../domain/types';

/** Distance of each scale degree from the tonic, in fifths (major scale / natural minor scale). */
const MAJOR = [0, 2, 4, -1, 1, 3, 5];
const MINOR = [0, 2, -3, -1, 1, -4, -2];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export interface Numeral {
  /** Number of sharps (positive) or flats (negative) in front of the numeral. */
  accidental: number;
  /** 1..7 */
  degree: number;
  /** Upper case = major, lower case = minor. */
  mode: Mode;
}

/** 'bVI' -> flat 6th degree, major; '#iv' -> raised 4th degree, minor. Null if it is not a roman numeral. */
export function parseNumeral(text: string): Numeral | null {
  const m = text.trim().replace(/♯/g, '#').replace(/♭/g, 'b').match(/^([#b]*)(vii|vi|v|iv|iii|ii|i)$/i);
  if (!m) return null;
  const letters = m[2];
  const upper = letters === letters.toUpperCase();
  const lower = letters === letters.toLowerCase();
  if (!upper && !lower) return null;
  const accidental = [...m[1]].reduce((n, c) => n + (c === '#' ? 1 : -1), 0);
  return { accidental, degree: ROMAN.indexOf(letters.toUpperCase()) + 1, mode: upper ? 'major' : 'minor' };
}

/**
 * The key a numeral names when counted from `base`. In a minor base key the degrees are those of the
 * natural minor scale (so 'III' is the relative major, 'VI' and 'VII' lie a whole tone and a semitone below the tonic).
 */
export function keyAbove(base: Key, numeral: string): Key | null {
  const n = parseNumeral(numeral);
  if (!n) return null;
  const scale = base.mode === 'major' ? MAJOR : MINOR;
  return { fifths: base.fifths + scale[n.degree - 1] + 7 * n.accidental, mode: n.mode };
}

/** DCML spells the global key in English note names: 'C', 'Bb', 'f#' (lower case = minor). */
export function parseGlobalKey(text: string): Key | null {
  return parseKey(text, 'en');
}

/** The key of a chord's `relativeroot`, e.g. 'V/V' from the local key: the right-most part is counted from the local key. */
export function keyOfRelativeRoot(local: Key, relativeRoot: string): Key | null {
  let key: Key | null = local;
  for (const part of relativeRoot.split('/').reverse()) {
    key = keyAbove(key, part);
    if (!key) return null;
  }
  return key;
}
