import { describe, expect, it } from 'vitest';
import { buildCaption } from '../analysis/caption';
import { computeStats } from '../analysis/stats';
import { keyDistance } from './distance';
import { createExample } from './example';
import { parseKey } from './keys';
import { createPiece } from './piece';
import { makeEvent } from './structure';
import { applyAllFixes, applyFix, validate } from './validate';
import type { Piece } from './types';

const K = (s: string) => parseKey(s, 'de')!;
const seg = (id: string, from: number, to: number, key = 'c', kind: 'key' | 'dominant' = 'key') => ({ id, from, to, key: K(key), kind, label: '' });

function piece(): Piece {
  const p = createPiece();
  p.meta.lastBar = 16;
  p.meta.center = K('c');
  return p;
}

describe('distance measures', () => {
  const c = K('c');
  it('rows: relatives are 0 apart, same-tonic keys 3', () => {
    expect(keyDistance(c, K('Es'), 'rows').distance).toBe(0);
    expect(keyDistance(c, K('C'), 'rows').distance).toBe(3);
    expect(keyDistance(c, K('G'), 'rows').signed).toBe(4);
    expect(keyDistance(c, K('As'), 'rows').signed).toBe(-1);
  });
  it('tonic: same-tonic keys are 0 apart, relatives 3', () => {
    expect(keyDistance(c, K('C'), 'tonic').distance).toBe(0);
    expect(keyDistance(c, K('Es'), 'tonic').distance).toBe(3);
    expect(keyDistance(c, K('g'), 'tonic').signed).toBe(1);
  });
  it('steps: shortest path over fifth, relative and same-tonic moves', () => {
    expect(keyDistance(c, c, 'steps').distance).toBe(0);
    expect(keyDistance(c, K('Es'), 'steps').distance).toBe(1); // relative
    expect(keyDistance(c, K('C'), 'steps').distance).toBe(1); // same tonic
    expect(keyDistance(c, K('g'), 'steps').distance).toBe(1); // fifth
    expect(keyDistance(c, K('B'), 'steps').distance).toBe(2); // relative, then fifth
    expect(keyDistance(c, K('As'), 'steps').distance).toBe(2);
    const far = keyDistance(c, K('fis'), 'steps');
    expect(far.distance).toBeGreaterThan(2);
    // symmetric
    expect(keyDistance(K('fis'), c, 'steps').distance).toBe(far.distance);
  });
  it('changes the statistics but not the chart rows', () => {
    const ex = createExample();
    const rows = computeStats(ex, { measure: 'rows' });
    const steps = computeStats(ex, { measure: 'steps' });
    expect(rows.summary.maxDistance).toBe(4);
    expect(steps.summary.maxDistance).not.toBe(rows.summary.maxDistance);
    expect(rows.summary.exactHomeShare).toBeLessThan(rows.summary.homeShare); // Es-Dur counts for the row only
    expect(steps.measure).toBe('steps');
  });
});

describe('validation', () => {
  it('finds overlaps, gaps, and bad positions, and fixes them', () => {
    const p = piece();
    p.segments = [seg('a', 1, 6), seg('b', 4, 9), seg('c', 11, 17)];
    const codes = validate(p).map((i) => i.code);
    expect(codes).toContain('overlap');
    expect(codes).toContain('gap');
    expect(applyAllFixes(p)).toBe(2);
    expect(validate(p).filter((i) => i.severity !== 'info')).toEqual([]);
    expect(p.segments.map((s) => [s.from, s.to])).toEqual([[1, 4], [4, 11], [11, 17]]);
  });
  it('treats gaps that hold passing chords as hints, not problems', () => {
    const p = piece();
    p.segments = [seg('a', 1, 5), seg('b', 8, 17)];
    p.passing = [{ id: 'p', pos: 5.5, key: K('d') }];
    const gap = validate(p).find((i) => i.code === 'gap-passing')!;
    expect(gap.severity).toBe('info');
    expect(gap.fix).toBeUndefined();
  });
  it('flags empty, early and late segments', () => {
    const p = piece();
    p.meta.pickup = 0;
    p.segments = [seg('a', 1, 1), seg('b', 0.5, 5), seg('c', 5, 20)];
    const codes = validate(p).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['empty-segment', 'before-start', 'beyond-end']));
    applyAllFixes(p);
    expect(p.segments.find((s) => s.id === 'a')).toBeUndefined();
    expect(p.segments.find((s) => s.id === 'b')!.from).toBe(1);
    expect(p.meta.lastBar).toBe(19);
  });
  it('checks structure events', () => {
    const p = piece();
    p.segments = [seg('a', 1, 17)];
    p.events.push(
      makeEvent('repeat-start', 3), makeEvent('meter', 5.5, { beats: 3, unit: 4 }),
      makeEvent('section', 8, { name: 'A' }), makeEvent('section', 8, { name: 'B' }), makeEvent('volta', 10, { to: 10 }),
    );
    const codes = validate(p).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['repeat-start-orphan', 'meter-not-on-bar', 'duplicate-event', 'volta-empty']));
    applyAllFixes(p);
    expect(p.events.map((e) => e.kind).sort()).toEqual(['meter', 'section']);
    expect(p.events.find((e) => e.kind === 'meter')!.pos).toBe(6);
  });
  it('leaves a clean example alone', () => {
    expect(validate(createExample()).filter((i) => i.severity !== 'info')).toEqual([]);
  });
  it('does not crash on a fix whose target vanished', () => {
    const p = piece();
    p.segments = [seg('a', 1, 1)];
    const issue = validate(p)[0];
    p.segments = [];
    expect(applyFix(p, issue)).toBe(false);
  });
});

describe('caption', () => {
  it('describes the figure and the conventions in German', () => {
    const { caption, method } = buildCaption(createExample(), { figure: '3' });
    expect(caption).toContain('Abb. 3: Tonartenverlauf in Haydn, Klaviersonate c-Moll, 1. Satz (Hob. XVI:20), T. 1–120.');
    expect(caption).toContain('gestrichelte Balken');
    expect(caption).toContain('Kreise Durchgangsakkorde');
    expect(caption).toContain('Es-Dur / c-Moll');
    expect(method).toContain('Methode:');
    expect(method).toContain('117 von 120');
    expect(method).toContain('gleichnamige Tonarten (z. B. c-Moll und C-Dur)');
  });
  it('follows the language, view and distance measure', () => {
    const p = createExample();
    p.style.language = 'en';
    p.meta.distanceMeasure = 'steps';
    const { caption, method } = buildCaption(p, { view: { from: 70, to: 81 } });
    expect(caption).toMatch(/^Key plan of Haydn.*bars 70–80\./);
    expect(method).toContain('fewest steps');
    p.meta.distanceMeasure = 'tonic';
    expect(buildCaption(p).method).toContain('same tonic are 0 apart');
  });
  it('mentions repeats only when there are some', () => {
    const p = createExample();
    expect(buildCaption(p).method).not.toContain('Wiederhol');
    p.events.push(makeEvent('repeat-end', 9, { times: 2 }));
    expect(buildCaption(p).method).toContain('einmal gezählt');
    expect(buildCaption(p, { countRepeats: true }).method).toContain('Spielreihenfolge');
  });
});
