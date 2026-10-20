import { describe, expect, it } from 'vitest';
import { renderChart } from '../render/chart';
import { createExample } from './example';
import { createPiece, normalizePiece, normalizeStyle } from './piece';
import { formatPos, parsePos } from './positions';
import { parseSegments } from './segments-text';
import {
  deleteBars, endPos, expandPlayOrder, insertBars, makeEvent, meterMap, playIntervals, sectionSpans, startPos,
} from './structure';
import type { Piece } from './types';

const key = { fifths: 0, mode: 'major' as const };
const seg = (from: number, to: number) => ({ id: `s${from}`, from, to, key, kind: 'key' as const, label: '' });

function base(): Piece {
  const p = createPiece();
  p.meta.lastBar = 16;
  p.segments = [seg(1, 5), seg(5, 9), seg(9, 17)];
  return p;
}

describe('meter changes', () => {
  it('uses the default meter until an event changes it', () => {
    const p = base();
    p.events.push(makeEvent('meter', 9, { beats: 3, unit: 4 }));
    const m = meterMap(p);
    expect(m.at(1).beats).toBe(4);
    expect(m.at(8.99).beats).toBe(4);
    expect(m.at(9).beats).toBe(3);
    expect(m.at(12.5).beats).toBe(3);
  });
  it('counts beats in the meter of the bar', () => {
    const p = base();
    p.events.push(makeEvent('meter', 9, { beats: 3, unit: 4 }));
    const m = meterMap(p);
    expect(parsePos('10:3', m)).toBeCloseTo(10 + 2 / 3);
    expect(parsePos('10:4', m)).toBeNull();
    expect(parsePos('4:4', m)).toBe(4.75);
    expect(formatPos(10 + 2 / 3, m)).toBe('10:3');
    const parsed = parseSegments('9:2-10 c', 'de', m);
    expect(parsed.errors).toEqual([]);
    expect(parsed.segments[0].from).toBeCloseTo(9 + 1 / 3);
  });
});

describe('anacrusis', () => {
  it('starts the chart before bar 1 and accepts bar 0', () => {
    const p = base();
    p.meta.pickup = 1;
    expect(startPos(p)).toBe(0.75);
    p.segments.unshift(seg(0.75, 1));
    const chart = renderChart(p);
    expect(chart.geometry.from).toBe(0.75);
    expect(formatPos(0.75, meterMap(p))).toBe('0:4');
  });
});

describe('inserting and deleting bars', () => {
  it('stretches what straddles the insertion point', () => {
    const p = createExample();
    insertBars(p, 10, 2);
    const dominant = p.segments.find((s) => s.from === 9)!; // 9-11 >As
    expect(dominant.to).toBe(13);
    expect(p.segments.find((s) => s.from === 13)).toBeDefined(); // 11-13 As moved to 13-15
  });
  it('moves later material and the end of the piece', () => {
    const p = base();
    p.annotations.push({ id: 'a', pos: 12, key, text: 'x', align: 'left', dx: 0, dy: 0, hidden: false });
    p.events.push(makeEvent('section', 9, { name: 'B' }), makeEvent('volta', 13, { to: 15, numbers: [1] }));
    insertBars(p, 9, 3);
    expect(p.segments.map((s) => [s.from, s.to])).toEqual([[1, 5], [5, 9], [12, 20]]);
    expect(p.annotations[0].pos).toBe(15);
    expect(p.events.find((e) => e.kind === 'section')!.pos).toBe(12);
    expect(p.events.find((e) => e.kind === 'volta')).toMatchObject({ pos: 16, to: 18 });
    expect(p.meta.lastBar).toBe(19);
  });
  it('removes bars, trimming and dropping what falls inside', () => {
    const p = base();
    p.passing.push({ id: 'p', pos: 6.5, key });
    p.annotations.push({ id: 'a', pos: 7, key, text: 'x', align: 'left', dx: 0, dy: 0, hidden: false });
    p.events.push(makeEvent('section', 6, { name: 'B' }), makeEvent('marker', 7, { label: 'M' }), makeEvent('barline', 12, {}));
    deleteBars(p, 5, 4); // removes bars 5-8
    expect(p.segments.map((s) => [s.from, s.to])).toEqual([[1, 5], [5, 13]]);
    expect(p.passing).toEqual([]);
    expect(p.annotations).toEqual([]);
    expect(p.events.map((e) => [e.kind, e.pos])).toEqual([['section', 5], ['barline', 8]]);
    expect(p.meta.lastBar).toBe(12);
  });
  it('insert followed by delete restores the piece', () => {
    const p = createExample();
    const json = JSON.stringify(p.segments.map((s) => [s.from, s.to]));
    insertBars(p, 20, 5);
    deleteBars(p, 20, 5);
    expect(JSON.stringify(p.segments.map((s) => [s.from, s.to]))).toBe(json);
    expect(p.meta.lastBar).toBe(120);
  });
});

describe('sections', () => {
  it('builds two levels with sub-parts inside their main part', () => {
    const p = base();
    p.events.push(
      makeEvent('section', 1, { name: 'Exposition' }),
      makeEvent('subsection', 1, { name: 'Thema 1' }),
      makeEvent('subsection', 5, { name: 'Überleitung' }),
      makeEvent('section', 9, { name: '1. Durchführung' }),
      makeEvent('subsection', 9, { name: 'Thema 1' }),
      makeEvent('section', 13, { name: '2. Durchführung' }),
    );
    const spans = sectionSpans(p);
    expect(spans.map((s) => [s.name, s.from, s.to])).toEqual([['Exposition', 1, 9], ['1. Durchführung', 9, 13], ['2. Durchführung', 13, 17]]);
    expect(spans[0].subs.map((s) => [s.name, s.from, s.to])).toEqual([['Thema 1', 1, 5], ['Überleitung', 5, 9]]);
    expect(spans[1].subs).toHaveLength(1);
    expect(spans[2].subs).toHaveLength(0);
  });
  it('draws a second label row only when sub-parts exist', () => {
    const p = base();
    p.events.push(makeEvent('section', 1, { name: 'A' }));
    const plain = renderChart(p);
    p.events.push(makeEvent('subsection', 1, { name: 'a1' }));
    const withSub = renderChart(p);
    expect(withSub.height - plain.height).toBe(20);
    expect(withSub.svg).toContain('>a1<');
    p.style.show.subsections = false;
    expect(renderChart(p).height).toBe(plain.height);
  });
});

describe('repeats', () => {
  function repeated(): Piece {
    const p = createPiece();
    p.meta.lastBar = 12;
    p.segments = [seg(1, 5), seg(5, 9), seg(9, 13)];
    p.events.push(makeEvent('repeat-start', 1), makeEvent('repeat-end', 9, { times: 2 }));
    return p;
  }
  it('plays a repeated passage twice', () => {
    expect(playIntervals(repeated())).toEqual([{ from: 1, to: 9 }, { from: 1, to: 9 }, { from: 9, to: 13 }]);
  });
  it('plays the numbered endings in their pass', () => {
    const p = repeated();
    p.events.push(makeEvent('volta', 7, { to: 9, numbers: [1] }), makeEvent('volta', 9, { to: 11, numbers: [2] }));
    expect(playIntervals(p)).toEqual([
      { from: 1, to: 9 }, // first pass with ending 1 (bars 7-8)
      { from: 1, to: 7 }, // second pass without it …
      { from: 9, to: 13 }, // … and on with ending 2 (bars 9-10) and the rest
    ]);
  });
  it('lays the piece out in play order with notated bar numbers on the axis', () => {
    const p = repeated();
    const ex = expandPlayOrder(p);
    expect(ex.piece.meta.lastBar).toBe(20);
    expect(ex.piece.segments.map((s) => [s.from, s.to])).toEqual([[1, 5], [5, 9], [9, 13], [13, 17], [17, 21]]);
    expect(ex.labelOf(9)).toBe('1');
    expect(ex.labelOf(17)).toBe('9');
    expect(endPos(ex.piece)).toBe(21);
  });
  it('draws repeat signs, or the expanded chart, depending on the setting', () => {
    const p = repeated();
    const symbols = renderChart(p);
    expect(symbols.svg).toContain('stroke-width="2.4"');
    p.style.repeatDisplay = 'expanded';
    const expanded = renderChart(p);
    expect(expanded.svg).not.toContain('stroke-width="2.4"');
    expect(expanded.geometry.to).toBe(21);
    p.style.show.repeats = false;
    p.style.repeatDisplay = 'symbols';
    expect(renderChart(p).svg).not.toContain('stroke-width="2.4"');
  });
  it('draws endings, meter signs and other markers', () => {
    const p = repeated();
    p.events.push(
      makeEvent('volta', 7, { to: 9, numbers: [1] }), makeEvent('meter', 9, { beats: 3, unit: 4 }),
      makeEvent('text', 1, { label: 'Allegro' }), makeEvent('keysig', 9, { fifths: -3 }),
      makeEvent('barline', 13, { style: 'final' }), makeEvent('fermata', 12.5),
    );
    const svg = renderChart(p).svg;
    expect(svg).toContain('>1.<');
    expect(svg).toContain('>3/4<');
    expect(svg).toContain('>4/4<'); // the starting meter is shown once the meter changes
    expect(svg).toContain('>Allegro<');
    expect(svg).toContain('>3<'); // key signature: the number as text, the flat drawn as a shape
    expect(svg).toContain('<g transform="translate(');
  });
});

describe('migration', () => {
  it('turns sections and markers of earlier files into events', () => {
    const p = normalizePiece({
      meta: { title: 'x', lastBar: null },
      segments: [],
      sections: [{ id: 's', name: 'Exposition', from: 1, shade: true }],
      markers: [{ id: 'm', pos: 10, label: 'A', line: false }],
    })!;
    expect(p.events.map((e) => [e.kind, e.pos, e.name || e.label])).toEqual([['section', 1, 'Exposition'], ['marker', 10, 'A']]);
    expect(p.events[0].shade).toBe(true);
    expect(p.events[1].line).toBe(false);
    expect(p.meta.lastBar).toBeNull();
    expect(p.meta.pickup).toBe(0);
  });
});

describe('damaged or old stored data', () => {
  it('keeps defaults where a stored field has the wrong shape', () => {
    const p = normalizePiece({ meta: { title: 'ok' }, segments: [], style: 7, events: 3, passing: 'p', highlights: null })!;
    expect(p.meta.title).toBe('ok');
    expect(p.style.colors.majorFill).toBe('#9FE1CB');
    expect(p.events).toEqual([]);
    expect(p.passing).toEqual([]);
    expect(renderChart(p).svg).toContain('<svg');
  });
  it('upgrades a style saved by the first version', () => {
    const style = normalizeStyle({ barWidth: 6, fontScale: 1.2, show: { grid: false } });
    expect(style.barWidth).toBe(6);
    expect(style.fontScale).toBe(1.2);
    expect(style.show.grid).toBe(false);
    expect(style.show.annotations).toBe(true);
    expect(style.rowNames).toEqual({});
    expect(style.hatch).toBe(false);
    expect(normalizeStyle(12).colors.text).toBe('#2C2C2A');
  });
});

describe('pieces damaged by repeated conversion', () => {
  it('does not convert sections and markers again once there are events', () => {
    const polluted = {
      meta: { title: 'x' },
      segments: [],
      // events already converted in an earlier load, and the old lists still lying around
      events: [
        { id: 's1', kind: 'section', pos: 1, name: 'A' },
        { id: 's1', kind: 'section', pos: 1, name: 'A' },
        { id: 'm1', kind: 'marker', pos: 4, label: 'B' },
      ],
      sections: [{ id: 's1', name: 'A', from: 1, shade: false }],
      markers: [{ id: 'm1', pos: 4, label: 'B', line: true }],
    };
    const p = normalizePiece(polluted)!;
    expect(p.events.map((e) => e.id)).toEqual(['s1', 'm1']);
    expect('sections' in p).toBe(false);
    expect('markers' in p).toBe(false);
    // loading what was saved again changes nothing
    expect(normalizePiece(JSON.parse(JSON.stringify(p)))!.events).toHaveLength(2);
  });
  it('gives every row of every list its own id', () => {
    const seg = { from: 1, to: 2, key: { fifths: 0, mode: 'major' }, kind: 'key' };
    const p = normalizePiece({ meta: {}, segments: [{ ...seg, id: 'a' }, { ...seg, id: 'a' }], passing: [{ id: 'p', pos: 1, key: seg.key }, { id: 'p', pos: 2, key: seg.key }] })!;
    expect(new Set(p.segments.map((s) => s.id)).size).toBe(2);
    expect(new Set(p.passing.map((s) => s.id)).size).toBe(2);
  });
});

describe('repeat signs in the chart', () => {
  it('leaves out signs on the edge of a zoomed view and makes room for the others', () => {
    const p = createPiece();
    p.meta.lastBar = 12;
    p.segments = [seg(1, 5), seg(5, 9), seg(9, 13)];
    p.events.push(makeEvent('repeat-start', 1), makeEvent('repeat-end', 9, { times: 2 }));
    const whole = renderChart(p);
    expect(whole.svg).toContain('stroke-width="2.4"');
    const edge = renderChart(p, { view: { from: 9, to: 13 } });
    expect(edge.svg).not.toContain('stroke-width="2.4"');
    expect(edge.height).toBeLessThan(whole.height);
    const inside = renderChart(p, { view: { from: 2, to: 12 } });
    expect(inside.svg).toContain('stroke-width="2.4"');
  });
});

describe('connectors in a zoomed view', () => {
  it('does not draw a join that lies on the view edge', () => {
    const p = createPiece();
    p.meta.lastBar = 12;
    p.segments = [seg(1, 5), { ...seg(5, 9), key: { fifths: 2, mode: 'major' } }, seg(9, 13)];
    const joins = (svg: string) => (svg.match(/stroke-opacity="0.6" stroke-linecap="round"/g) ?? []).length;
    expect(joins(renderChart(p).svg)).toBe(2);
    expect(joins(renderChart(p, { view: { from: 1, to: 9 } }).svg)).toBe(1); // the join at 9 is the edge
    expect(joins(renderChart(p, { view: { from: 5, to: 13 } }).svg)).toBe(1); // the join at 5 is the edge
    expect(joins(renderChart(p, { view: { from: 3, to: 11 } }).svg)).toBe(2);
  });
});
