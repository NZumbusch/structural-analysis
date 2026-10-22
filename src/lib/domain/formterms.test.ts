import { describe, expect, it } from 'vitest';
import { termsOf, VOCABULARIES } from './formterms';

describe('form theory terms', () => {
  it('has zones and points in every vocabulary, without clashing abbreviations', () => {
    for (const v of VOCABULARIES) {
      expect(termsOf(v.id, 'zone').length).toBeGreaterThan(3);
      expect(termsOf(v.id, 'point').length).toBeGreaterThan(2);
      const abbr = v.terms.map((t) => t.abbr);
      expect(new Set(abbr).size).toBe(abbr.length);
      for (const t of v.terms) {
        expect(t.defDe.length).toBeGreaterThan(10);
        expect(t.defEn.length).toBeGreaterThan(10);
      }
    }
  });
  it('gives the structural points of sonata theory a line through the chart', () => {
    const points = termsOf('sonata-theory', 'point');
    for (const a of ['MC', 'EEC', 'ESC']) expect(points.find((t) => t.abbr === a)?.line).toBe(true);
    for (const a of ['HC', 'PAC']) expect(points.find((t) => t.abbr === a)?.line).toBeFalsy();
  });
});
