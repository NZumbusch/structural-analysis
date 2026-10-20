import { keyName, parseKey } from './keys';
import { newId } from './ids';
import { formatPos, parsePos, type MeterSource } from './positions';
import type { NoteNames, Segment, SegmentKind } from './types';

export interface ParseError {
  line: number;
  message: 'format' | 'key' | 'range' | 'position';
}

export interface ParseResult {
  segments: Segment[];
  errors: ParseError[];
}

/** `>` secondary dominant, `>L` leading-tone chord, `>N` Neapolitan, `>T` other tonicisation. */
const KIND_OF_PREFIX: Record<string, SegmentKind> = { '>': 'dominant', '>L': 'leading', '>N': 'neapolitan', '>T': 'tonicization' };
const PREFIX_OF_KIND: Record<SegmentKind, string> = { key: '', dominant: '>', leading: '>L ', neapolitan: '>N ', tonicization: '>T ' };

const POS = String.raw`\d+(?:[.,]\d+)?(?::\d+(?:[.,]\d+)?)?`;
const LINE = new RegExp(String.raw`^(${POS})\s*[-–—]\s*(${POS})\s+(>[LNT]?)?\s*([^"]+?)\s*(?:"([^"]*)")?$`);

/**
 * Parses the quick-entry text, one stretch per line:
 *
 *     1-9 c                 c minor from bar 1 until the next stretch starts in bar 9
 *     9-11 >As              secondary dominant aiming at A-flat major
 *     41-42:3 f             positions may be beats: bar 42, beat 3 (= 42.5 in 4/4)
 *     44-45 As "V7"         optional text on the bar
 *     // comment
 *
 * Ids are reused by position so that editors bound to a segment keep their identity while typing.
 */
export function parseSegments(
  text: string,
  names: NoteNames,
  meter: MeterSource,
  previous: Segment[] = [],
): ParseResult {
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
    const from = parsePos(m[1], meter);
    const to = parsePos(m[2], meter);
    if (from === null || to === null) {
      errors.push({ line: i + 1, message: 'position' });
      return;
    }
    const key = parseKey(m[4], names);
    if (!key) {
      errors.push({ line: i + 1, message: 'key' });
      return;
    }
    if (!(to > from)) {
      errors.push({ line: i + 1, message: 'range' });
      return;
    }
    segments.push({
      id: previous[segments.length]?.id ?? newId(),
      from,
      to,
      key,
      kind: KIND_OF_PREFIX[m[3] ?? ''] ?? 'key',
      label: m[5] ?? '',
    });
  });
  return { segments, errors };
}

export function serializeSegments(segments: Segment[], names: NoteNames, meter: MeterSource): string {
  return segments
    .map(
      (s) =>
        `${formatPos(s.from, meter)}-${formatPos(s.to, meter)} ${PREFIX_OF_KIND[s.kind]}${keyName(s.key, names)}` +
        (s.label ? ` "${s.label.replace(/"/g, "'")}"` : ''),
    )
    .join('\n');
}
