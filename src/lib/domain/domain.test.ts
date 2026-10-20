import { describe, expect, it } from 'vitest';
import { keyName, parseKey, rowLabel, rowOf, tonicName } from './keys';
import { parseSegments, serializeSegments } from './segments-text';
import { createExample } from './example';
import { displayTitle, normalizePiece } from './piece';
import { renderChart } from '../render/chart';
import { formatPos, parsePos, snapPos } from './positions';
import type { Meter } from './types';

const M: Meter = { beats: 4, unit: 4 };

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
    const text = '1-9 c\n9-11 >As\n41-42:3 f';
    const { segments, errors } = parseSegments(text, 'de', M);
    expect(errors).toEqual([]);
    expect(segments).toHaveLength(3);
    expect(segments[1].kind).toBe('dominant');
    expect(segments[2].to).toBe(42.5);
    expect(serializeSegments(segments, 'de', M)).toBe(text);
  });
  it('reports bad lines and keeps good ones', () => {
    const { segments, errors } = parseSegments('1-9 c\nnonsense\n9-5 d\n9-12 q', 'de', M);
    expect(segments).toHaveLength(1);
    expect(errors.map((e) => [e.line, e.message])).toEqual([[2, 'format'], [3, 'range'], [4, 'key']]);
  });
  it('ignores comments and accepts comma decimals', () => {
    const { segments, errors } = parseSegments('// hi\n1-2,5 C // x', 'de', M);
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

describe('positions', () => {
  it('parses bars, decimals and beats', () => {
    expect(parsePos('74')).toBe(74);
    expect(parsePos('42.5')).toBe(42.5);
    expect(parsePos('42:3')).toBe(42.5);
    expect(parsePos('42:2.5', M)).toBe(42.375);
    expect(parsePos('9:1', { beats: 3, unit: 4 })).toBe(9);
    expect(parsePos('9:4', { beats: 3, unit: 4 })).toBeNull();
    expect(parsePos('0')).toBeNull();
    expect(parsePos('x')).toBeNull();
  });
  it('round-trips through formatPos for several meters', () => {
    for (const meter of [M, { beats: 3, unit: 4 }, { beats: 6, unit: 8 }]) {
      for (let bar = 1; bar < 4; bar++) {
        for (let b = 1; b < meter.beats + 1; b += 0.5) {
          const pos = parsePos(`${bar}:${b}`, meter)!;
          expect(parsePos(formatPos(pos, meter), meter)).toBeCloseTo(pos, 9);
        }
      }
    }
    expect(formatPos(42.5, M)).toBe('42:3');
    expect(formatPos(42, M)).toBe('42');
  });
  it('snaps to beats', () => {
    expect(snapPos(42.37, 'beat', M)).toBe(42.25);
    expect(snapPos(42.37, 'half', M)).toBe(42.375);
    expect(snapPos(42.37, 'bar', M)).toBe(42);
    expect(snapPos(0.2, 'bar', M)).toBe(1);
  });
});

describe('segment labels and beats', () => {
  it('parses beat positions and bar labels', () => {
    const { segments, errors } = parseSegments('41-42:3 f "i6"\n42:3-43 >Es', 'de', M);
    expect(errors).toEqual([]);
    expect(segments[0]).toMatchObject({ from: 41, to: 42.5, label: 'i6' });
    expect(serializeSegments(segments, 'de', M)).toBe('41-42:3 f "i6"\n42:3-43 >Es');
  });
});

describe('chart features', () => {
  it('zooms into a range with its own scale and clipping', () => {
    const p = createExample();
    const full = renderChart(p);
    const zoom = renderChart(p, { view: { from: 70, to: 80 } });
    expect(zoom.geometry.ppb).toBeCloseTo(72);
    expect(zoom.geometry.from).toBe(70);
    expect(zoom.svg).toContain('clip-path="url(#plot-clip)"');
    expect(zoom.svg).toContain('Takt 70–79');
    expect(full.geometry.ppb).toBe(6);
    // rows adapt to what is visible
    expect(renderChart(p, { view: { from: 40, to: 50 } }).geometry.topRow).toBeLessThan(full.geometry.topRow);
  });
  it('draws bar and beat grids only when zoomed in', () => {
    const p = createExample();
    expect(renderChart(p).svg).not.toContain('stroke-dasharray="1 3"');
    expect(renderChart(p, { view: { from: 70, to: 76 } }).svg).toContain('stroke-dasharray="1 3"');
  });
  it('adds handles only in interactive mode', () => {
    const p = createExample();
    expect(renderChart(p).svg).not.toContain('data-kind');
    const svg = renderChart(p, { interactive: { handle: 10, selected: p.segments[0].id } }).svg;
    expect(svg).toContain('data-handle="from"');
    expect(svg).toContain('data-handle="to"');
    expect(svg).toContain('data-kind="passing"');
    expect(svg).toContain('stroke="#0a84ff"');
  });
  it('hides annotations and draws bar labels, markers and leaders', () => {
    const p = createExample();
    p.style.show.annotations = false;
    expect(renderChart(p).svg).not.toContain('chromatische');
    p.style.show.annotations = true;
    p.annotations[0].hidden = true;
    expect(renderChart(p).svg).not.toContain('as-Moll');
    p.annotations[0].hidden = false;
    p.annotations[1].dx = 40;
    p.annotations[1].dy = 30;
    expect(renderChart(p).svg).toContain('r="1.6"');
    p.segments[0].label = 'Thema';
    p.markers.push({ id: 'm', pos: 38, label: 'A', line: true });
    const svg = renderChart(p).svg;
    expect(svg).toContain('>Thema<');
    expect(svg).toContain('stroke-dasharray="4 3"');
  });
  it('supports flat or sharp spelling of the outer rows', () => {
    const p = createExample();
    p.style.enharmonic = 'sharps';
    expect(renderChart(p).svg).toContain('Cis · ais');
    p.style.enharmonic = 'flats';
    p.style.rowNames = { '-7': 'Ces-Dur · as-Moll' };
    expect(renderChart(p).svg).toContain('Ces-Dur · as-Moll');
  });
  it('writes a physical size for SVG output', () => {
    const svg = renderChart(createExample(), { widthCm: 16 }).svg;
    expect(svg).toContain('width="16cm"');
    expect(svg).toContain('viewBox="0 0 900 565"');
  });
  it('migrates files from the first version', () => {
    const p = normalizePiece({
      meta: { title: 'x' },
      segments: [{ id: 'a', from: 1, to: 3, key: { fifths: 0, mode: 'major' }, kind: 'key' }],
      passing: [{ id: 'p', bar: 74, key: { fifths: 2, mode: 'major' } }],
      annotations: [{ id: 'n', bar: 59, key: { fifths: 0, mode: 'major' }, text: 't', align: 'left' }],
    })!;
    expect(p.passing[0].pos).toBe(74.5);
    expect(p.annotations[0]).toMatchObject({ pos: 59, dx: 0, dy: 0, hidden: false });
    expect(p.meta.meter).toEqual({ beats: 4, unit: 4 });
    expect(p.segments[0].label).toBe('');
    expect(p.views).toEqual([]);
  });
});
