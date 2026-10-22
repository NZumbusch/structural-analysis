import { describe, expect, it } from 'vitest';
import { de } from '../i18n/de';
import { createExample } from '../domain/example';
import { fold, getValue, GROUPS, searchSettings, setValue, SETTINGS } from './registry';
import { publicationChecks } from '../export/checks';
import { applyPreset, PRESETS } from '../export/presets';
import { defaultExportPrefs } from '../export/prefs';
import { labelPoints } from '../export/fit';
import { renderChart } from '../render/chart';

const tr = (k: keyof typeof de) => de[k];

describe('registry', () => {
  it('has unique ids, known texts and sensible paths', () => {
    expect(new Set(SETTINGS.map((s) => s.id)).size).toBe(SETTINGS.length);
    const p = createExample();
    const roots = { style: p.style, meta: p.meta, export: defaultExportPrefs() };
    for (const s of SETTINGS) {
      expect(de[s.label], s.id).toBeTruthy();
      if (s.hint) expect(de[s.hint], s.id).toBeTruthy();
      expect(GROUPS.some((g) => g.id === s.group)).toBe(true);
      const c = s.control;
      if (c.type !== 'custom') expect(getValue(roots, c.path) !== undefined || c.type === 'number', `${s.id} ${c.path}`).toBe(true);
      if (c.type === 'select') for (const o of c.options) if (typeof o.label === 'string') expect(de[o.label], `${s.id} ${o.label}`).toBeTruthy();
    }
  });

  it('reads and writes by path', () => {
    const roots = { style: { show: { grid: true } }, export: { widthCm: 16 } };
    expect(getValue(roots, 'style.show.grid')).toBe(true);
    setValue(roots, 'style.show.grid', false);
    expect(roots.style.show.grid).toBe(false);
    expect(getValue(roots, 'style.nope.deeper')).toBeUndefined();
  });
});

describe('search', () => {
  const ids = (q: string) => searchSettings(q, tr).map((s) => s.id);

  it('finds by label, by synonym and across languages', () => {
    expect(ids('titel')[0]).toBe('title');
    expect(ids('linien')).toContain('lineScale');
    expect(ids('line width')).toContain('lineScale');
    expect(ids('schriftgroesse')).toContain('fontScale');
    expect(ids('SCHRIFTGRÖSSE')).toContain('fontScale');
    expect(ids('hatch')).toContain('hatch');
    expect(ids('cmyk')).toContain('cmyk');
  });

  it('needs every word, ignores accents and returns everything for an empty query', () => {
    expect(ids('titel quinten')).not.toContain('title');
    expect(ids('quinten spalte')).toContain('fifthsColumn');
    expect(ids('')).toHaveLength(SETTINGS.length);
    expect(ids('zzzzzz')).toEqual([]);
    expect(fold('Größe ß')).toBe('grosse ss');
  });
});

describe('publication helpers', () => {
  it('flags text and lines that print too small', () => {
    const p = createExample();
    const wide = publicationChecks(p, { widthCm: 24, fonts: 'embed', problems: 0 });
    const narrow = publicationChecks(p, { widthCm: 5, fonts: 'none', problems: 2 });
    const level = (list: typeof wide, id: string) => list.find((c) => c.id === id)?.level;
    expect(level(wide, 'textSize')).toBe('ok');
    expect(level(narrow, 'textSize')).toBe('warn');
    expect(level(narrow, 'lines')).toBe('warn');
    expect(level(narrow, 'fonts')).toBe('warn');
    expect(level(narrow, 'valid')).toBe('warn');
    expect(level(wide, 'source')).toBe('warn');
    expect(level(wide, 'color')).toBe('warn');
    p.style.hatch = true;
    expect(level(publicationChecks(p, { widthCm: 16, fonts: 'embed', problems: 0 }), 'color')).toBe('ok');
  });

  it('notices a stale image description and a mismatching measure', () => {
    const p = createExample();
    p.meta.altText = 'Es gibt 99 Wechsel zwischen Tonarten.';
    p.meta.distanceMeasure = 'steps';
    const list = publicationChecks(p, { widthCm: 16, fonts: 'embed', problems: 0 });
    expect(list.find((c) => c.id === 'alt')?.level).toBe('warn');
    expect(list.find((c) => c.id === 'measure')?.level).toBe('warn');
    p.meta.altText = 'Ein eigener Text ohne Zahlen.';
    expect(publicationChecks(p, { widthCm: 16, fonts: 'embed', problems: 0 }).some((c) => c.id === 'alt')).toBe(false);
  });

  it('presets set width, look and a fitting text size', () => {
    for (const preset of PRESETS) {
      const p = createExample();
      const exp = defaultExportPrefs();
      applyPreset(p, exp, preset);
      if (preset.id === 'screen') continue;
      expect(exp.widthCm).toBe(preset.widthCm);
      expect(exp.mode).toBe('physical');
      expect(Math.abs(labelPoints(p, preset.widthCm) - preset.targetPt)).toBeLessThan(0.15);
    }
    const p = createExample();
    applyPreset(p, defaultExportPrefs(), PRESETS[0]);
    expect(p.style.hatch).toBe(true);
    expect(p.style.margins).toBe('tight');
    expect(p.style.show.title).toBe(false);
    expect(renderChart(p).svg).not.toContain('Haydn · Klaviersonate c-Moll, 1. Satz</text>');
  });
});

describe('layout robustness', () => {
  it('keeps the fifths heading inside the picture with tight margins and big text', () => {
    const p = createExample();
    p.style.margins = 'tight';
    p.style.fontScale = 2.4;
    const { svg, width } = renderChart(p);
    const m = svg.match(/<text x="([\d.]+)"[^>]*text-anchor="middle">Quinten<\/text>/);
    expect(m).toBeTruthy();
    const half = ('Quinten'.length * 12.5 * 2.4 * 0.52) / 2;
    expect(Number(m![1]) + half).toBeLessThanOrEqual(width);
  });

  it('print presets lift thin lines to a printable weight', () => {
    const p = createExample();
    applyPreset(p, defaultExportPrefs(), PRESETS[0]);
    const list = publicationChecks(p, { widthCm: 8.5, fonts: 'embed', problems: 0 });
    expect(list.find((c) => c.id === 'lines')?.level).toBe('ok');
    expect(list.find((c) => c.id === 'textSize')?.level).toBe('ok');
  });
});
