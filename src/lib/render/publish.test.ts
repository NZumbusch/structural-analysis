import { describe, expect, it } from 'vitest';
import { createExample } from '../domain/example';
import { cloneStyle, DEFAULT_STYLE, normalizeStyle } from '../domain/piece';
import { renderChart } from './chart';

const example = () => createExample();
const widths = (svg: string) => [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]));

describe('settings for publishing', () => {
  it('old styles get the new defaults', () => {
    const s = normalizeStyle({ fontScale: 1.2 });
    expect(s.show.title).toBe(true);
    expect(s.margins).toBe('normal');
    expect(s.lineScale).toBe(1);
    expect(s.legendLabels).toEqual({});
  });

  it('leaves out the headline and moves the plot up', () => {
    const a = renderChart(example());
    const p = example();
    p.style.show.title = false;
    const b = renderChart(p);
    expect(a.svg).toContain('Haydn · Klaviersonate c-Moll, 1. Satz</text>');
    expect(b.svg).not.toContain('Haydn · Klaviersonate c-Moll, 1. Satz</text>');
    expect(b.svg).toContain('Erreichte Tonarten'); // the subtitle stays
    expect(b.height).toBeLessThan(a.height);
    p.style.show.subtitle = false;
    const c = renderChart(p);
    expect(c.svg).not.toContain('Erreichte Tonarten nach Takt</text>');
    expect(c.height).toBeLessThan(b.height);
    expect(c.geometry.firstRowY).toBeLessThan(b.geometry.firstRowY);
    // the picture still says what it shows, for screen readers
    expect(c.svg).toContain('aria-label="Haydn');
  });

  it('crops tight margins', () => {
    const a = renderChart(example());
    const p = example();
    p.style.margins = 'tight';
    const b = renderChart(p);
    expect(b.width).toBeLessThan(a.width);
    expect(b.height).toBeLessThan(a.height);
    expect(b.geometry.left).toBeLessThan(a.geometry.left);
    p.style.show.title = false;
    p.style.show.subtitle = false;
    const c = renderChart(p);
    expect(c.height).toBeLessThan(b.height);
    expect(c.svg).toContain('<svg');
  });

  it('scales every line width', () => {
    const a = widths(renderChart(example()).svg);
    const p = example();
    p.style.lineScale = 2;
    const b = widths(renderChart(p).svg);
    expect(b).toHaveLength(a.length);
    expect(b.every((w, i) => Math.abs(w - Math.round(a[i] * 2 * 100) / 100) < 0.011)).toBe(true);
  });

  it('uses own legend wording, axis titles and signed distances', () => {
    const p = example();
    p.style.legendLabels = { dominant: 'Dominante', major: 'Dur (hell)' };
    p.style.axisTitle = 'T.';
    p.style.fifthsTitle = 'Quintabstand';
    p.style.fifthsSigned = true;
    const svg = renderChart(p).svg;
    expect(svg).toContain('>Dominante</text>');
    expect(svg).toContain('>Dur (hell)</text>');
    expect(svg).toContain('>T.</text>');
    expect(svg).toContain('>Quintabstand</text>');
    expect(svg).toMatch(/>\+\d<\/text>/);
    expect(svg).toMatch(/>−\d<\/text>/);
  });

  it('draws square bars when asked', () => {
    const p = example();
    p.style.barShape = 'square';
    const svg = renderChart(p).svg;
    expect(svg).toContain('rx="2"');
    expect(svg).not.toMatch(/rx="7"/);
    expect(cloneStyle(DEFAULT_STYLE).barShape).toBe('round');
  });
});

describe('legend spacing', () => {
  it('leaves room between the marker lane and the legend', async () => {
    const { makeEvent } = await import('../domain/structure');
    const plain = renderChart(example());
    const p = example();
    p.events.push(makeEvent('marker', 30, { label: 'EEC', line: true }));
    const withMark = renderChart(p);
    expect(withMark.height).toBeGreaterThan(plain.height); // the lane and the extra air
    const legendY = (svg: string) => Number(svg.match(/<text x="[\d.]+" y="([\d.]+)"[^>]*>Dur<\/text>/)![1]);
    const laneBottom = (svg: string) => {
      const m = svg.match(/<rect x="[\d.]+" y="([\d.]+)" width="[\d.]+" height="([\d.]+)" rx="3"[^>]*>/);
      return Number(m![1]) + Number(m![2]);
    };
    expect(legendY(withMark.svg) - laneBottom(withMark.svg)).toBeGreaterThanOrEqual(18);
  });
});

describe('marker stacking', () => {
  it('puts colliding marker labels on a second row instead of shifting them', async () => {
    const { makeEvent } = await import('../domain/structure');
    const p = example();
    p.events.push(makeEvent('marker', 30, { label: 'EEC' }));
    const one = renderChart(p);
    p.events.push(makeEvent('marker', 30.1, { label: 'PAC' }));
    const two = renderChart(p);
    expect(two.height).toBeGreaterThan(one.height);
    const ys = [...two.svg.matchAll(/<rect x="[\d.]+" y="([\d.]+)" width="[\d.]+" height="[\d.]+" rx="3"/g)].map((m) => Number(m[1]));
    expect(new Set(ys).size).toBeGreaterThan(1);
  });
});

describe('legend in zoomed views', () => {
  it('lists only what is visible in the section', () => {
    const p = example();
    const whole = renderChart(p).svg;
    expect(whole).toContain('Durchgangsakkord');
    const zoom = renderChart(p, { view: { from: 1, to: 20 } as never }).svg;
    expect(zoom).not.toContain('Durchgangsakkord');
  });
});
