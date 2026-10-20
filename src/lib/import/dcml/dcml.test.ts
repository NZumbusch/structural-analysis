import { describe, expect, it } from 'vitest';
import { keyName } from '../../domain/keys';
import { validate } from '../../domain/validate';
import { convertDcml, DEFAULT_DCML_OPTIONS } from './convert';
import { keyAbove, keyOfRelativeRoot, parseGlobalKey, parseNumeral } from './numeral';
import { groupFiles, listCorpora, listPieces, loadPiece, parseRepoRef, type Fetcher } from './source';
import { frac, parseTsv } from './tsv';

const tsv = (rows: Record<string, string | number>[]): string => {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return [cols.join('\t'), ...rows.map((r) => cols.map((c) => String(r[c] ?? '')).join('\t'))].join('\n');
};
const name = (k: { fifths: number; mode: 'major' | 'minor' }) => keyName(k, 'en');

describe('tables', () => {
  it('reads fractions and quoted cells', () => {
    expect(frac('3/4')).toBe(0.75);
    expect(frac('4.0')).toBe(4);
    expect(frac('')).toBeNaN();
    expect(parseTsv('a\tb\n"x ""y"""\t2\n')).toEqual([{ a: 'x "y"', b: '2' }]);
  });
});

describe('numerals', () => {
  it('counts local keys from the global key', () => {
    const c = parseGlobalKey('C')!;
    expect(name(keyAbove(c, 'V')!)).toBe('G');
    expect(name(keyAbove(c, 'vi')!)).toBe('a');
    expect(name(keyAbove(c, 'bVI')!)).toBe('Ab');
    expect(name(keyAbove(c, '#iv')!)).toBe('f#');
  });
  it('uses the natural minor scale in minor keys', () => {
    const a = parseGlobalKey('a')!;
    expect(name(keyAbove(a, 'III')!)).toBe('C');
    expect(name(keyAbove(a, 'v')!)).toBe('e');
    expect(name(keyAbove(a, 'VI')!)).toBe('F');
    expect(name(keyAbove(a, 'VII')!)).toBe('G');
    const c = parseGlobalKey('c')!;
    expect(name(keyAbove(c, 'III')!)).toBe('Eb');
    expect(name(keyAbove(c, 'VI')!)).toBe('Ab');
  });
  it('reads English note names including flats and sharps', () => {
    expect(name(parseGlobalKey('Bb')!)).toBe('Bb');
    expect(name(parseGlobalKey('bb')!)).toBe('bb');
    expect(name(parseGlobalKey('f#')!)).toBe('f#');
    expect(name(parseGlobalKey('B')!)).toBe('B');
  });
  it('resolves chains of applied chords from the right', () => {
    const c = parseGlobalKey('C')!;
    expect(name(keyOfRelativeRoot(c, 'V')!)).toBe('G');
    expect(name(keyOfRelativeRoot(c, 'V/V')!)).toBe('D');
    expect(name(keyOfRelativeRoot(c, 'V/V/V')!)).toBe('A');
    expect(name(keyOfRelativeRoot(c, 'iv')!)).toBe('f');
  });
  it('rejects what is not a numeral', () => {
    expect(parseNumeral('Vi')).toBeNull();
    expect(parseNumeral('x')).toBeNull();
    expect(keyAbove(parseGlobalKey('C')!, 'foo')).toBeNull();
  });
});

describe('sources', () => {
  it('understands links to repositories, commits and files', () => {
    const base = { owner: 'DCMLab', repo: 'mozart_piano_sonatas' };
    expect(parseRepoRef('https://github.com/DCMLab/mozart_piano_sonatas')).toEqual({ ...base, ref: 'main' });
    expect(parseRepoRef('https://github.com/DCMLab/mozart_piano_sonatas/tree/ad4a9dfa3a08b70b8af637572640a3819c5878e2')).toEqual({ ...base, ref: 'ad4a9dfa3a08b70b8af637572640a3819c5878e2' });
    expect(parseRepoRef('github.com/DCMLab/mozart_piano_sonatas/blob/v2.1/metadata.tsv')).toEqual({ ...base, ref: 'v2.1' });
    expect(parseRepoRef('DCMLab/mozart_piano_sonatas@v2.1')).toEqual({ ...base, ref: 'v2.1' });
    expect(parseRepoRef('https://raw.githubusercontent.com/DCMLab/ABC/main/metadata.tsv')).toEqual({ owner: 'DCMLab', repo: 'ABC', ref: 'main' });
    expect(parseRepoRef('nonsense')).toBeNull();
  });

  const files: Record<string, string> = {
    'https://raw.githubusercontent.com/DCMLab/dcml_corpora/main/.gitmodules': '[submodule "x"]\n\tpath = ABC\n\turl = git@github.com:DCMLab/ABC.git\n[submodule "y"]\n\tpath = m\n\turl = https://github.com/DCMLab/mozart_piano_sonatas\n',
    'https://raw.githubusercontent.com/DCMLab/m/main/metadata.tsv': tsv([{ piece: 'K1-1', workTitle: 'Sonata', movementNumber: 1, movementTitle: 'Allegro', composer: 'W', annotated_key: 'C', last_mn: 10, label_count: 5 }]),
    'https://raw.githubusercontent.com/DCMLab/m/main/harmonies/K1-1.harmonies.tsv': tsv([{ mc: 1, mc_onset: 0, globalkey: 'C', localkey: 'I' }]),
  };
  const fetcher: Fetcher = async (url) => files[url] ?? null;

  it('lists corpora from the collection repository', async () => {
    expect(await listCorpora(fetcher)).toEqual([
      { owner: 'DCMLab', repo: 'ABC' },
      { owner: 'DCMLab', repo: 'mozart_piano_sonatas' },
    ]);
  });
  it('lists and loads pieces, with or without a measure table', async () => {
    const repo = { owner: 'DCMLab', repo: 'm', ref: 'main' };
    const pieces = await listPieces(repo, fetcher);
    expect(pieces.map((p) => [p.piece, p.title, p.key, p.labels])).toEqual([['K1-1', 'Sonata – 1. Allegro', 'C', 5]]);
    const input = await loadPiece(repo, pieces[0], fetcher);
    expect(input.measures).toBeUndefined();
    expect(input.source?.repo).toBe('m');
    await expect(loadPiece(repo, { ...pieces[0], piece: 'nope' }, fetcher)).rejects.toThrow();
  });
  it('groups chosen files by piece and recognises their kind', () => {
    const h = tsv([{ mc: 1, localkey: 'I', globalkey: 'C' }]);
    const m = tsv([{ mc: 1, act_dur: '1', timesig: '4/4' }]);
    const meta = tsv([{ piece: 'A', last_mc: 1 }]);
    const { inputs, ignored } = groupFiles([
      { name: 'A.harmonies.tsv', text: h }, { name: 'A.measures.tsv', text: m }, { name: 'metadata.tsv', text: meta },
      { name: 'B.measures.tsv', text: m }, { name: 'other.tsv', text: 'x\ty\n1\t2' },
    ]);
    expect(inputs).toHaveLength(1);
    expect(inputs[0].piece).toBe('A');
    expect(inputs[0].measures).toBe(m);
    expect(inputs[0].metadata?.piece).toBe('A');
    expect(ignored).toEqual(['other.tsv', 'B (measures)']);
  });
});

const harmonies = (rows: Record<string, string | number>[]) =>
  tsv(rows.map((r) => ({ mc_onset: 0, globalkey: 'C', ...r })));
const bars = (n: number, extra: Record<number, Record<string, string | number>> = {}) =>
  tsv(Array.from({ length: n }, (_, i) => ({ mc: i + 1, keysig: 0, timesig: '4/4', act_dur: '1', mc_offset: 0, ...(extra[i + 1] ?? {}) })));

describe('key path', () => {
  const input = {
    piece: 'P',
    harmonies: harmonies([
      { mc: 1, localkey: 'I' }, { mc: 2, localkey: 'I' },
      { mc: 3, localkey: 'V' }, { mc: 4, localkey: 'V', mc_onset: '1/2' },
      { mc: 5, localkey: 'vi' },
      { mc: 6, localkey: 'I', mc_onset: '3/4' },
    ]),
    measures: bars(8),
  };

  it('turns changes of the local key into segments covering the whole piece', () => {
    const { piece, counts } = convertDcml(input);
    expect(piece.segments.map((s) => [s.from, s.to, name(s.key), s.kind])).toEqual([
      [1, 3, 'C', 'key'], [3, 5, 'G', 'key'], [5, 6.75, 'a', 'key'], [6.75, 9, 'C', 'key'],
    ]);
    expect(piece.meta.lastBar).toBe(8);
    expect(name(piece.meta.center)).toBe('C');
    expect(counts.keys).toBe(4);
    expect(validate(piece).filter((i) => i.severity !== 'info')).toEqual([]);
  });

  it('adds applied chords as dashed tonicisations only when asked', () => {
    const withApplied = {
      ...input,
      harmonies: harmonies([
        { mc: 1, localkey: 'I', numeral: 'I' },
        { mc: 2, localkey: 'I', numeral: 'V', relativeroot: 'IV', mc_onset: '1/2' },
        { mc: 2, localkey: 'I', numeral: 'IV', mc_onset: '3/4' },
        { mc: 3, localkey: 'I', numeral: 'vii', relativeroot: 'V' },
      ]),
    };
    expect(convertDcml(withApplied).piece.segments.map((s) => s.kind)).toEqual(['key']);
    const r = convertDcml(withApplied, { ...DEFAULT_DCML_OPTIONS, tonicizations: true });
    expect(r.piece.segments.map((s) => [s.from, s.to, name(s.key), s.kind])).toEqual([
      [1, 2.5, 'C', 'key'], [2.5, 2.75, 'F', 'dominant'], [2.75, 3, 'C', 'key'], [3, 9, 'G', 'leading'],
    ]);
    expect(r.counts.tonicizations).toBe(2);
  });

  it('does not invent anything for unknown local keys', () => {
    const { piece, warnings } = convertDcml({ ...input, harmonies: harmonies([{ mc: 1, localkey: 'I' }, { mc: 2, localkey: '??' }]) });
    expect(piece.segments).toHaveLength(1);
    expect(warnings).toContainEqual({ code: 'bad-localkey', arg: '??' });
  });
});

describe('structure', () => {
  it('reads repeats and numbered endings from the measure table', () => {
    const { piece, counts, warnings } = convertDcml({
      piece: 'P',
      harmonies: harmonies([{ mc: 1, localkey: 'I' }]),
      measures: bars(9, {
        4: { next: '1, 5' },
        5: { next: '6' }, 6: { next: '7, 8' },
        7: { volta: 1, next: '5' }, 8: { volta: 2, next: '9' },
      }),
    });
    const at = (kind: string) => piece.events.filter((e) => e.kind === kind).map((e) => [e.pos, e.to, e.numbers.join()]);
    expect(piece.events.filter((e) => e.kind === 'repeat-start').map((e) => e.pos)).toEqual([1, 5]);
    expect(piece.events.filter((e) => e.kind === 'repeat-end').map((e) => e.pos)).toEqual([5, 8]);
    expect(at('volta')).toEqual([[7, 8, '1'], [8, 9, '2']]);
    expect(counts.repeats).toBe(2);
    expect(counts.endings).toBe(2);
    expect(warnings).toContainEqual({ code: 'volta-numbering' });
    expect(validate(piece).filter((i) => i.severity !== 'info')).toEqual([]);
  });

  it('leaves out what is switched off', () => {
    const input = { piece: 'P', harmonies: harmonies([{ mc: 1, localkey: 'I' }]), measures: bars(4, { 4: { next: '1' }, 2: { barline: 'double' } }) };
    const off = { ...DEFAULT_DCML_OPTIONS, repeats: false, barlines: false, attribution: false };
    const r = convertDcml(input, off);
    expect(r.piece.events).toEqual([]);
    expect(r.piece.meta.source).toBe('');
    expect(convertDcml(input).piece.events.map((e) => e.kind).sort()).toEqual(['barline', 'repeat-end', 'repeat-start']);
  });

  it('follows time and key signature changes', () => {
    const { piece } = convertDcml({
      piece: 'P',
      harmonies: harmonies([{ mc: 1, localkey: 'I' }]),
      measures: bars(4, { 3: { timesig: '3/4', act_dur: '3/4', keysig: 2 }, 4: { timesig: '3/4', act_dur: '3/4', keysig: 2 } }),
    }, { ...DEFAULT_DCML_OPTIONS, keysigs: true });
    expect(piece.events.filter((e) => e.kind === 'meter').map((e) => [e.pos, e.beats, e.unit])).toEqual([[3, 3, 4]]);
    expect(piece.events.filter((e) => e.kind === 'keysig').map((e) => [e.pos, e.fifths])).toEqual([[3, 2]]);
    expect(piece.meta.meter).toEqual({ beats: 4, unit: 4 });
  });

  it('counts an anacrusis as bar 0 and joins the halves of a split bar', () => {
    const { piece } = convertDcml({
      piece: 'P',
      harmonies: harmonies([
        { mc: 1, localkey: 'I' }, { mc: 2, localkey: 'I' },
        { mc: 3, localkey: 'V' }, { mc: 4, localkey: 'V', cadence: 'PAC' },
        { mc: 5, localkey: 'I' },
      ]),
      measures: bars(5, {
        1: { act_dur: '1/4', mc_offset: '3/4', next: '2' },
        3: { act_dur: '3/4', next: '1, 4' },
        4: { act_dur: '1/4', mc_offset: '3/4' },
      }),
    }, { ...DEFAULT_DCML_OPTIONS, cadences: true });
    expect(piece.meta.pickup).toBe(1);
    expect(piece.segments.map((s) => [s.from, s.to, name(s.key)])).toEqual([[0.75, 2, 'C'], [2, 3, 'G'], [3, 4, 'C']]);
    expect(piece.events.filter((e) => e.kind === 'repeat-start').map((e) => e.pos)).toEqual([0.75]);
    expect(piece.events.filter((e) => e.kind === 'repeat-end').map((e) => e.pos)).toEqual([2.75]);
    expect(piece.events.find((e) => e.kind === 'marker')).toMatchObject({ pos: 2.75, label: 'PAC', line: false });
    expect(piece.meta.lastBar).toBe(3);
  });

  it('works from the labels alone when there is no measure table', () => {
    const r = convertDcml({ piece: 'P', harmonies: harmonies([{ mc: 1, localkey: 'I', timesig: '3/4' }, { mc: 4, localkey: 'V', timesig: '3/4' }]) });
    expect(r.piece.meta.meter).toEqual({ beats: 3, unit: 4 });
    expect(r.piece.segments.map((s) => [s.from, s.to])).toEqual([[1, 4], [4, 5]]);
    expect(r.warnings).toContainEqual({ code: 'no-measures' });
  });
});

describe('metadata', () => {
  it('fills title, movement, catalogue and provenance', () => {
    const { piece } = convertDcml({
      piece: 'K279-1',
      harmonies: harmonies([{ mc: 1, localkey: 'I' }]),
      measures: bars(2),
      metadata: { workTitle: 'Piano Sonata no. 1 in C major', composer: 'Wolfgang Amadeus Mozart', movementNumber: '1', movementTitle: 'Allegro', workNumber: 'K279', composed_end: '1775', annotators: 'A', reviewers: 'B' },
      source: { repo: 'mozart_piano_sonatas', ref: 'ad4a9dfa3a08b70b8af637572640a3819c5878e2', url: 'https://github.com/DCMLab/mozart_piano_sonatas/tree/ad4a9df' },
    }, DEFAULT_DCML_OPTIONS, 'en');
    expect(piece.meta).toMatchObject({ title: 'Piano Sonata no. 1 in C major', composer: 'Wolfgang Amadeus Mozart', movement: '1. Allegro', catalog: 'K279', year: '1775' });
    expect(piece.meta.source).toContain('mozart_piano_sonatas ad4a9df K279-1');
    expect(piece.meta.notes).toContain('Annotation: A; Review: B');
  });
});

describe('tables with multi-line cells', () => {
  it('keeps a quoted cell with a line break in one record', () => {
    const rows = parseTsv('piece\tcomposer\tn\nA\t"W. A. Mozart\n(1756-1791)"\t1\nB\tx\t2\n');
    expect(rows).toEqual([{ piece: 'A', composer: 'W. A. Mozart\n(1756-1791)', n: '1' }, { piece: 'B', composer: 'x', n: '2' }]);
  });
  it('treats quotation marks inside a cell literally', () => {
    expect(parseTsv('a\tb\nI"x\t2\r\nV\t3')).toEqual([{ a: 'I"x', b: '2' }, { a: 'V', b: '3' }]);
  });
});
