import { describe, expect, it } from 'vitest';
import { keyName, parseKey, rowLabel, rowOf, tonicName } from './keys';
import { parseSegments, serializeSegments } from './segments-text';
import { createExample } from './example';
import { displayTitle, normalizePiece } from './piece';
import { renderChart } from '../render/chart';

describe('keys', () => {
  it('parses German names', () => {
    expect(parseKey('c')).toEqual({ fifths: 0, mode: 'minor' });
    expect(parseKey('Es')).toEqual({ fifths: -3, mode: 'major' });
    expect(parseKey('es')).toEqual({ fifths: -3, mode: 'minor' });
    expect(parseKey('as')).toEqual({ fifths: -4, mode: 'minor' });
    expect(parseKey('B')).toEqual({ fifths: -2, mode: 'major' });
    expect(parseKey('h')).toEqual({ fifths: 5, mode: 'minor' });
    expect(parseKey('Fis')).toEqual({ fifths: 6, mode: 'major' });
    expect(parseKey('Ces')).toEqual({ fifths: -7, mode: 'major' });
  });
  it('parses English names and mode suffixes', () => {
    expect(parseKey('B', 'en')).toEqual({ fifths: 5, mode: 'major' });
    expect(parseKey('Bb', 'en')).toEqual({ fifths: -2, mode: 'major' });
    expect(parseKey('F#m', 'en')).toEqual({ fifths: 6, mode: 'minor' });
    expect(parseKey('A-Dur')).toEqual({ fifths: 3, mode: 'major' });
    expect(parseKey('f minor')).toEqual({ fifths: -1, mode: 'minor' });
    expect(parseKey('x')).toBeNull();
    expect(parseKey('Cxyz')).toBeNull();
  });
  it('puts minor keys in the row of their relative major', () => {
    expect(rowOf(parseKey('c')!)).toBe(-3);
    expect(rowOf(parseKey('a')!)).toBe(0);
    expect(rowOf(parseKey('b')!)).toBe(-5);
  });
  it('names rows like the original chart', () => {
    expect(rowLabel(-3, 'de')).toBe('Es · c');
    expect(rowLabel(2, 'de')).toBe('D · h');
    expect(rowLabel(-7, 'de')).toBe('Ces · as');
    expect(rowLabel(-6, 'de')).toBe('Ges · es');
    expect(rowLabel(-5, 'de')).toBe('Des · b');
    expect(rowLabel(-3, 'en')).toBe('Eb · c');
  });
  it('round-trips key names', () => {
    for (let f = -9; f <= 9; f++) {
      for (const mode of ['major', 'minor'] as const) {
        for (const names of ['de', 'en'] as const) {
          const key = { fifths: f, mode };
          expect(parseKey(keyName(key, names), names), `${f} ${mode} ${names}`).toEqual(key);
        }
      }
    }
    expect(tonicName(-2, 'de')).toBe('B');
  });
});

describe('segment text', () => {
  it('parses and serialises', () => {
    const text = '1-9 c\n9-11 >As\n41-42.5 f';
    const { segments, errors } = parseSegments(text, 'de');
    expect(errors).toEqual([]);
    expect(segments).toHaveLength(3);
    expect(segments[1].kind).toBe('dominant');
    expect(segments[2].to).toBe(42.5);
    expect(serializeSegments(segments, 'de')).toBe(text);
  });
  it('reports bad lines and keeps good ones', () => {
    const { segments, errors } = parseSegments('1-9 c\nnonsense\n9-5 d\n9-12 q', 'de');
    expect(segments).toHaveLength(1);
    expect(errors.map((e) => [e.line, e.message])).toEqual([[2, 'format'], [3, 'range'], [4, 'key']]);
  });
  it('ignores comments and accepts comma decimals', () => {
    const { segments, errors } = parseSegments('// hi\n1-2,5 C // x', 'de');
    expect(errors).toEqual([]);
    expect(segments[0].to).toBe(2.5);
  });
});

describe('chart', () => {
  it('renders the example with the original size', () => {
    const chart = renderChart(createExample());
    expect(chart.width).toBe(900);
    expect(chart.height).toBe(565);
    expect(chart.svg).toContain('Haydn · Klaviersonate c-Moll, 1. Satz');
  });
  it('renders an empty piece', () => {
    const piece = normalizePiece({ meta: {}, segments: [] })!;
    expect(renderChart(piece).svg).toContain('<svg');
  });
  it('composes the title', () => {
    const p = createExample();
    p.style.showYear = true;
    expect(displayTitle(p)).toBe('Haydn · Klaviersonate c-Moll, 1. Satz (1771)');
    p.style.titleLayout = 'title';
    expect(displayTitle(p)).toBe('Klaviersonate c-Moll, 1. Satz (1771)');
  });
  it('escapes text', () => {
    const p = createExample();
    p.meta.title = 'A <b> & "c"';
    expect(renderChart(p).svg).toContain('A &lt;b&gt; &amp; &quot;c&quot;');
  });
});
