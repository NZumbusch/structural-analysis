import type { Key, Mode, NoteNames } from './types';

/** Minor keys sit in the row of their relative major, three fifths below their own tonic. */
const MINOR_OFFSET = 3;

const LETTERS = ['F', 'C', 'G', 'D', 'A', 'E', 'H'] as const;
const LETTER_FIFTHS: Record<string, number> = { F: -1, C: 0, G: 1, D: 2, A: 3, E: 4, H: 5 };

/** The row (position of the major key on the circle of fifths) a key is drawn in. */
export function rowOf(key: Key): number {
  return key.mode === 'major' ? key.fifths : key.fifths - MINOR_OFFSET;
}

export function keyFromRow(row: number, mode: Mode): Key {
  return { fifths: mode === 'major' ? row : row + MINOR_OFFSET, mode };
}

/** Name of a tonic, capitalised: 'Es', 'Fis', 'H' (de) or 'Eb', 'F#', 'B' (en). */
export function tonicName(fifths: number, names: NoteNames): string {
  const index = (((fifths + 1) % 7) + 7) % 7;
  const accidentals = Math.floor((fifths + 1) / 7);
  const letter = LETTERS[index];
  if (names === 'en') {
    const base = letter === 'H' ? 'B' : letter;
    return base + (accidentals > 0 ? '#'.repeat(accidentals) : 'b'.repeat(-accidentals));
  }
  if (accidentals > 0) return letter + 'is'.repeat(accidentals);
  if (accidentals === 0) return letter;
  const n = -accidentals;
  if (letter === 'H') return n === 1 ? 'B' : 'Heses' + 'es'.repeat(n - 2);
  if (letter === 'E' || letter === 'A') return letter + 's' + 'es'.repeat(n - 1);
  return letter + 'es'.repeat(n);
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** 'Es' for E-flat major, 'c' for C minor. */
export function keyName(key: Key, names: NoteNames): string {
  const name = tonicName(key.fifths, names);
  return key.mode === 'major' ? name : lowerFirst(name);
}

export type Enharmonic = 'auto' | 'flats' | 'sharps';

/** Row whose spelling to show: the same pitches written with flats or sharps for the outer rows. */
export function spellingRow(row: number, enharmonic: Enharmonic = 'auto'): number {
  if (enharmonic === 'flats' && row >= 5) return row - 12;
  if (enharmonic === 'sharps' && row <= -5) return row + 12;
  return row;
}

/** Row label such as 'Es · c'. */
export function rowLabel(row: number, names: NoteNames, enharmonic: Enharmonic = 'auto'): string {
  const r = spellingRow(row, enharmonic);
  return `${tonicName(r, names)} · ${lowerFirst(tonicName(r + MINOR_OFFSET, names))}`;
}

const MODE_WORDS = /[-\s]*(dur|major|maj|moll|minor|min)$/i;
const MINOR_WORDS = new Set(['moll', 'minor', 'min']);

/**
 * Parses a key such as 'Es', 'c', 'F#', 'fis', 'Bb', 'Cm', 'A-Dur', 'f minor'.
 * Capital first letter = major, lower case = minor, unless a mode suffix says otherwise.
 * German: B = B-flat, H = B-natural. English: B = B-natural.
 */
export function parseKey(input: string, names: NoteNames = 'de'): Key | null {
  let s = input.trim().replace(/♯/g, '#').replace(/♭/g, 'b');
  const head = s.match(/^([A-Ha-h])/);
  if (!head) return null;
  const letter = head[1];
  s = s.slice(1);

  let mode: Mode = letter === letter.toUpperCase() ? 'major' : 'minor';
  const word = s.match(MODE_WORDS);
  if (word) {
    mode = MINOR_WORDS.has(word[1].toLowerCase()) ? 'minor' : 'major';
    s = s.slice(0, word.index);
  } else if (/[mM]$/.test(s)) {
    mode = s.endsWith('m') ? 'minor' : 'major';
    s = s.slice(0, -1);
  }
  s = s.trim();

  const upper = letter.toUpperCase();
  let fifths: number;
  if (upper === 'B') fifths = names === 'de' ? LETTER_FIFTHS.H - 7 : LETTER_FIFTHS.H;
  else fifths = LETTER_FIFTHS[upper];

  while (s.length > 0) {
    const token = s.match(/^(is|es|s|#|b)/i);
    if (!token) return null;
    const t = token[1].toLowerCase();
    fifths += t === 'is' || t === '#' ? 7 : -7;
    s = s.slice(token[1].length);
  }
  return { fifths, mode };
}

export function sameKey(a: Key, b: Key): boolean {
  return a.fifths === b.fifths && a.mode === b.mode;
}
