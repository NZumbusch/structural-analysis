import { keyName, parseKey } from './keys';
import { newId } from './ids';
import type { NoteNames, Segment } from './types';

export interface ParseError {
  line: number;
  message: string;
}

export interface ParseResult {
  segments: Segment[];
  errors: ParseError[];
}

const LINE = /^(\d+(?:[.,]\d+)?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)\s*[:\s]\s*(>)?\s*(.+)$/;

function num(s: string): number {
  return parseFloat(s.replace(',', '.'));
}

/**
 * Parses the quick-entry text, one stretch per line:
 *
 *     1-9 c          c minor from bar 1 until bar 9 (the next stretch starts in bar 9)
 *     9-11 >As       secondary dominant aiming at A-flat major
 *     41-42.5 f      half bars are fine
 *     // comment
 *
 * Ids are reused by position so that editors bound to a segment keep their identity while typing.
 */
export function parseSegments(text: string, names: NoteNames, previous: Segment[] = []): ParseResult {
  const segments: Segment[] = [];
  const errors: ParseError[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/\/\/.*$/, '').trim();
    if (!line) return;
    const m = line.match(LINE);
    if (!m) {
      errors.push({ line: i + 1, message: 'format' });
      return;
    }
    const from = num(m[1]);
    const to = num(m[2]);
    const key = parseKey(m[4], names);
    if (!key) {
      errors.push({ line: i + 1, message: 'key' });
      return;
    }
    if (!(to > from) || from < 1) {
      errors.push({ line: i + 1, message: 'range' });
      return;
    }
    segments.push({
      id: previous[segments.length]?.id ?? newId(),
      from,
      to,
      key,
      kind: m[3] ? 'dominant' : 'key',
    });
  });
  return { segments, errors };
}

function fmt(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

export function serializeSegments(segments: Segment[], names: NoteNames): string {
  return segments
    .map((s) => `${fmt(s.from)}-${fmt(s.to)} ${s.kind === 'dominant' ? '>' : ''}${keyName(s.key, names)}`)
    .join('\n');
}
