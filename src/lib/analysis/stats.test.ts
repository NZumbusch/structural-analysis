import { describe, expect, it } from 'vitest';
import { createExample } from '../domain/example';
import { createPiece } from '../domain/piece';
import { chartDistance, chartKeys, chartProfile, chartSections, keyDisplay } from './charts';
import { formatNumber, toCsv, toTsv } from './csv';
import { buildSpans, computeStats } from './stats';

const stats = computeStats(createExample());

describe('stats', () => {
  it('covers every analysed bar exactly once', () => {
    const s = stats.summary;
    expect(s.analysedBars).toBe(117); // bars 1-120 minus the three passing-chord bars
    expect(s.gapBars).toBe(3);
    expect(stats.keys.reduce((n, k) => n + k.bars, 0)).toBeCloseTo(117);
    expect(stats.distances.reduce((n, d) => n + d.bars, 0)).toBeCloseTo(117);
    expect(stats.keys.reduce((n, k) => n + k.share, 0)).toBeCloseTo(1);
    expect(s.majorShare + s.minorShare).toBeCloseTo(1);
  });
  it('finds the extremes of the example', () => {
    expect(stats.summary.maxDistance).toBe(4); // as-Moll; D major is only a passing chord
    expect(stats.summary.farthest?.pos).toBe(57);
    expect(stats.summary.dominantCount).toBe(12);
    const c = stats.keys.find((k) => k.key.fifths === 0 && k.key.mode === 'minor')!;
    expect(c.established).toBe(8 + 1 + 4 + 9 + 18); // bars 1-9, 63-64, 69-73, 77-86, 103-121
    expect(c.visits).toBe(5);
  });
  it('counts modulations between established keys only', () => {
    expect(stats.modulations[0]).toMatchObject({ pos: 11, step: -1, distanceAfter: 1 });
    expect(stats.modulations.every((m) => m.from.fifths !== m.to.fifths || m.from.mode !== m.to.mode)).toBe(true);
    expect(stats.modulations[0].section).toBe('Exposition');
  });
  it('reports sections', () => {
    expect(stats.sections.map((s) => s.name)).toEqual(['Exposition', 'Durchführung', 'Reprise']);
    const total = stats.sections.reduce((n, s) => n + s.bars, 0);
    expect(total).toBeCloseTo(117);
    expect(stats.sections[0].byDistance.reduce((a, b) => a + b, 0)).toBeCloseTo(stats.sections[0].bars);
  });
  it('removes overlaps and handles an empty piece', () => {
    const p = createPiece();
    const key = { fifths: 0, mode: 'major' as const };
    p.segments = [
      { id: 'a', from: 1, to: 5, key, kind: 'key', label: '' },
      { id: 'b', from: 3, to: 8, key, kind: 'key', label: '' },
    ];
    expect(buildSpans(p).map((s) => [s.from, s.to])).toEqual([[1, 5], [5, 8]]);
    const empty = computeStats(createPiece());
    expect(empty.keys).toEqual([]);
    expect(empty.summary.meanDistance).toBe(0);
    expect(chartKeys(empty, createPiece(), 'duration').svg).toContain('<svg');
    expect(chartDistance(empty, createPiece()).svg).toContain('<svg');
    expect(chartProfile(empty, createPiece(), false).svg).toContain('<svg');
    expect(chartSections(empty, createPiece()).svg).toContain('<svg');
  });
});

describe('stat charts and csv', () => {
  const piece = createExample();
  it('draws all charts for the example', () => {
    for (const c of [chartKeys(stats, piece, 'duration'), chartKeys(stats, piece, 'fifths'), chartDistance(stats, piece), chartProfile(stats, piece, false), chartProfile(stats, piece, true), chartSections(stats, piece)]) {
      expect(c.svg.startsWith('<svg')).toBe(true);
      expect(c.svg.endsWith('</svg>')).toBe(true);
      expect(c.height).toBeGreaterThan(100);
    }
    expect(chartKeys(stats, piece, 'duration').svg).toContain('Es-Dur');
    expect(keyDisplay({ fifths: 0, mode: 'minor' }, piece)).toBe('c-Moll');
  });
  it('formats numbers and tables per locale', () => {
    expect(formatNumber(12.5, 'de', 1)).toBe('12,5');
    const cols = [
      { key: 'a', label: 'Name', value: (r: { a: string; b: number }) => r.a },
      { key: 'b', label: 'Wert', value: (r: { a: string; b: number }) => r.b, text: (r: { a: string; b: number }) => formatNumber(r.b, 'de') },
    ];
    const rows = [{ a: 'x;y', b: 1.5 }];
    expect(toCsv(cols, rows, 'de')).toBe('﻿Name;Wert\r\n"x;y";1,5\r\n');
    expect(toTsv(cols, rows)).toBe('Name\tWert\nx;y\t1,5');
  });
});

describe('alt text unit', () => {
  it('names the unit of the chosen distance measure', async () => {
    const { buildAltText } = await import('./caption');
    const { createExample } = await import('../domain/example');
    const p = createExample();
    expect(buildAltText(p)).toContain('Quinten, ab Takt');
    p.meta.distanceMeasure = 'steps';
    expect(buildAltText(p)).toMatch(/\d+ Schritte, ab Takt/);
  });
});
