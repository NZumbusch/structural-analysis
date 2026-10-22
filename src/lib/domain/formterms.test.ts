import { describe, expect, it } from 'vitest';
import { createPiece } from './piece';
import { CONCEPTS, termLabel, termsOf, TERM_DISPLAYS, VOCABULARIES, withTerms } from './formterms';
import { makeEvent } from './structure';
import { renderChart } from '../render/chart';
import { createExample } from './example';

describe('form theory terms', () => {
  it('has zones and points in every vocabulary, without clashing abbreviations', () => {
    expect(new Set(CONCEPTS.map((c) => c.id)).size).toBe(CONCEPTS.length);
    for (const v of VOCABULARIES) {
      expect(termsOf(v.id, 'zone').length).toBeGreaterThan(3);
      expect(termsOf(v.id, 'point').length).toBeGreaterThan(2);
      const short = v.terms.map((t) => t.short);
      expect(new Set(short).size).toBe(short.length);
    }
    for (const c of CONCEPTS) {
      expect(c.defDe.length).toBeGreaterThan(10);
      expect(c.defEn.length).toBeGreaterThan(10);
      expect(Object.keys(c.abbr).length).toBeGreaterThan(0);
    }
  });

  it('gives the structural points of sonata theory a line through the chart', () => {
    const points = termsOf('sonata-theory', 'point');
    for (const a of ['MC', 'EEC', 'ESC']) expect(points.find((t) => t.short === a)?.line).toBe(true);
    for (const a of ['HC', 'PAC']) expect(points.find((t) => t.short === a)?.line).toBeFalsy();
  });
});

describe('showing terms in another vocabulary', () => {
  it('translates what has a counterpart and leaves the rest', () => {
    expect(termLabel('second', 'S', 'german')).toBe('SS');
    expect(termLabel('second', 'S', 'caplin')).toBe('ST');
    expect(termLabel('second', 'SS', 'sonata-theory')).toBe('S');
    expect(termLabel('second', 'S', 'name-de')).toBe('Seitensatz');
    expect(termLabel('second', 'S', 'name-en')).toBe('Secondary theme');
    expect(termLabel('second', 'S', 'abbr-name-de')).toBe('S (Seitensatz)');
    // no counterpart: the entered text stays
    expect(termLabel('eec', 'EEC', 'german')).toBe('EEC');
    expect(termLabel('eec', 'EEC', 'caplin')).toBe('EEC');
    expect(termLabel('pres', 'pres.', 'german')).toBe('pres.'); // unknown concept
    // free text and the default mode change nothing
    expect(termLabel('', 'Thema', 'german')).toBe('Thema');
    expect(termLabel('second', 'S', 'entered')).toBe('S');
  });

  it('goes there and back without loss', () => {
    for (const c of CONCEPTS) {
      const entered = c.abbr['sonata-theory'] ?? c.abbr.german ?? c.abbr.caplin!;
      for (const mode of TERM_DISPLAYS) expect(termLabel(c.id, entered, mode).length).toBeGreaterThan(0);
      if (c.abbr['sonata-theory'] && c.abbr.german) {
        const there = termLabel(c.id, c.abbr['sonata-theory'], 'german');
        expect(termLabel(c.id, there, 'sonata-theory')).toBe(c.abbr['sonata-theory']);
      }
    }
  });

  it('changes only remembered terms in the chart', () => {
    const p = createExample();
    p.events.push(
      makeEvent('subsection', 1, { name: 'S', term: 'second' }),
      makeEvent('subsection', 20, { name: 'Eigenes Thema' }),
      makeEvent('marker', 30, { label: 'HC', line: false, term: 'hc' }),
    );
    expect(renderChart(p).svg).toContain('>S</text>');
    p.style.termDisplay = 'name-de';
    const shown = withTerms(p);
    expect(shown.events.find((e) => e.term === 'second')?.name).toBe('Seitensatz');
    expect(shown.events.find((e) => e.name === 'Eigenes Thema')?.name).toBe('Eigenes Thema');
    expect(shown.events.find((e) => e.term === 'hc')?.label).toBe('Halbschluss');
    const svg = renderChart(p).svg;
    expect(svg).toContain('>Seitensatz</text>');
    expect(svg).toContain('>Eigenes Thema</text>');
    expect(p.events.find((e) => e.term === 'second')?.name).toBe('S'); // the data is untouched
    expect(withTerms(createPiece())).toBeTruthy();
  });
});
