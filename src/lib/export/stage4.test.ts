import zlib from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { useNodeFonts } from '../../test/fonts';
import { buildCaption } from '../analysis/caption';
import { toCsv, type Column } from '../analysis/csv';
import { computeStats } from '../analysis/stats';
import { buildTables, latexEscape, toLatex, type Tr } from '../analysis/tables';
import { createExample } from '../domain/example';
import { parseSegments, serializeSegments } from '../domain/segments-text';
import { normalizePiece } from '../domain/piece';
import { renderChart } from '../render/chart';
import { analysisJson } from './analysis-json';
import { crc32 } from './zip';
import { APP_VERSION, stampOf, withPngText, withSvgMetadata } from './stamp';
import { svgToPdf } from './pdf';
import { projectBlob } from './files';

beforeAll(() => useNodeFonts());

const M = { beats: 4, unit: 4 };

/** A valid 1x1 PNG built by hand (signature, IHDR, IDAT, IEND). */
function tinyPng(): Uint8Array {
  const chunk = (type: string, data: number[]) => {
    const body = [...Buffer.from(type, 'latin1'), ...data];
    const crc = crc32(Uint8Array.from(body));
    const len = data.length;
    return [len >>> 24, (len >> 16) & 255, (len >> 8) & 255, len & 255, ...body, crc >>> 24, (crc >> 16) & 255, (crc >> 8) & 255, crc & 255];
  };
  const idat = [...zlib.deflateSync(Buffer.from([0, 0, 0, 0, 0]))];
  return Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, ...chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]), ...chunk('IDAT', idat), ...chunk('IEND', [])]);
}
const tr: Tr = (key) => key;

describe('tonicisation types', () => {
  it('parses and writes the prefixes', () => {
    const text = '1-5 c\n5-7 >G\n7-9 >L g\n9-11 >N Des\n11-13 >T F';
    const { segments, errors } = parseSegments(text, 'de', M);
    expect(errors).toEqual([]);
    expect(segments.map((s) => s.kind)).toEqual(['key', 'dominant', 'leading', 'neapolitan', 'tonicization']);
    expect(serializeSegments(segments, 'de', M)).toBe(text);
  });
  it('draws a different dash pattern and a legend entry per type', () => {
    const p = createExample();
    p.segments.push(
      { id: 'l', from: 121, to: 122, key: { fifths: 1, mode: 'major' }, kind: 'leading', label: '' },
      { id: 'n', from: 122, to: 123, key: { fifths: -5, mode: 'major' }, kind: 'neapolitan', label: '' },
    );
    const svg = renderChart(p).svg;
    expect(svg).toContain('stroke-dasharray="4 2 1 2"');
    expect(svg).toContain('stroke-dasharray="1.2 2.2"');
    expect(svg).toContain('Zwischenleittonakkord der folgenden Tonart');
    expect(svg).toContain('Neapolitaner der folgenden Tonart');
    const stats = computeStats(p);
    expect(stats.summary.dominantCount).toBeGreaterThan(12);
    expect(buildCaption(p).caption).toContain('strich-punktierte Balken');
  });
  it('keeps files from earlier versions readable', () => {
    const p = normalizePiece({ meta: {}, segments: [{ id: 'a', from: 1, to: 3, key: { fifths: 0, mode: 'major' }, kind: 'dominant' }, { id: 'b', from: 3, to: 5, key: { fifths: 0, mode: 'major' }, kind: 'weird' }] })!;
    expect(p.segments.map((s) => s.kind)).toEqual(['dominant', 'key']);
  });
});

describe('stamps and provenance', () => {
  it('writes metadata into the SVG', () => {
    const p = createExample();
    p.meta.source = 'Henle "Urtext" <2019>';
    p.meta.analyst = 'A. Analyst';
    const svg = withSvgMetadata(renderChart(p).svg, stampOf(p, new Date('2026-10-20T08:00:00Z')));
    expect(svg).toContain('<metadata><tonartenverlauf app="Tonartenverlauf"');
    expect(svg).toContain(`version="${APP_VERSION}"`);
    expect(svg).toContain('exported="2026-10-20T08:00:00.000Z"');
    expect(svg).toContain('source="Henle &quot;Urtext&quot; &lt;2019>"');
    expect(svg.indexOf('</desc><metadata>')).toBeGreaterThan(0);
  });
  it('adds well-formed text chunks to a PNG', () => {
    const png = tinyPng();
    const out = withPngText(png, stampOf(createExample()), 'Beschreibung ä');
    const dv = new DataView(out.buffer);
    let pos = 8;
    const types: string[] = [];
    while (pos < out.length) {
      const len = dv.getUint32(pos);
      const type = String.fromCharCode(...out.subarray(pos + 4, pos + 8));
      expect(dv.getUint32(pos + 8 + len)).toBe(crc32(out.subarray(pos + 4, pos + 8 + len)));
      types.push(type);
      pos += 12 + len;
    }
    expect(types[0]).toBe('IHDR');
    expect(types.filter((t) => t === 'iTXt').length).toBeGreaterThanOrEqual(4);
    expect(types[types.length - 1]).toBe('IEND');
    expect(new TextDecoder().decode(out)).toContain('Beschreibung ä');
  });
  it('puts author and creation date into the PDF', async () => {
    const text = new TextDecoder('latin1').decode(await svgToPdf(renderChart(createExample()).svg, { author: 'Ana', subject: 'Edition', creator: 'Tonartenverlauf 1.1.0', date: new Date('2026-10-20T08:00:00Z') }));
    expect(text).toContain('/CreationDate (D:20261020080000Z)');
    expect(text).toContain('/Author <FEFF');
  });
  it('records the app version in project files', async () => {
    const json = JSON.parse(await projectBlob([createExample()]).text());
    expect(json.app).toEqual({ name: 'Tonartenverlauf', version: APP_VERSION });
    expect(typeof json.exportedAt).toBe('string');
  });
  it('mentions source and analyst in the method note', () => {
    const p = createExample();
    p.meta.source = 'Henle 2019';
    p.meta.analyst = 'A. Analyst';
    p.meta.analysisDate = '2026-10-20';
    const { method } = buildCaption(p);
    expect(method).toContain('Grundlage: Henle 2019.');
    expect(method).toContain('Analyse: A. Analyst, 2026-10-20.');
  });
});

describe('tables and data export', () => {
  const p = createExample();
  const stats = computeStats(p);
  const tables = buildTables(p, stats, tr, 'de');
  it('builds every table from the same numbers', () => {
    expect(tables.segments.rows).toHaveLength(p.segments.length);
    expect(tables.keys.rows).toHaveLength(stats.keys.length);
    expect(tables.passing.rows).toHaveLength(3);
    expect(tables.sections.rows).toHaveLength(3);
    expect(tables.events.rows.map((e) => e.kind)).toEqual(['section', 'section', 'section']);
  });
  it('writes the segments as CSV with German conventions', () => {
    const csv = toCsv(tables.segments.columns as Column<unknown>[], tables.segments.rows, 'de');
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe('tbl.nr;tbl.from;tbl.to;tbl.len;tbl.key;tbl.mode;tbl.row;tbl.distance;tbl.kind;tbl.label');
    expect(lines[1]).toBe('1;1;9;8;c-Moll;tbl.minor;Es · c;0;kind.key;');
    expect(lines).toHaveLength(p.segments.length + 1);
    expect(lines.find((l) => l.startsWith('7;41;42:3;'))).toBeDefined(); // beat notation survives
  });
  it('writes booktabs LaTeX with escaped text', () => {
    const tex = toLatex(tables.keys, { floating: true, caption: 'Tonarten & Zeit', label: 'tab:keys' });
    expect(tex).toContain('\\usepackage{booktabs}');
    expect(tex).toContain('\\begin{table}');
    expect(tex).toContain('\\caption{Tonarten \\& Zeit}');
    expect(tex).toContain('\\label{tab:keys}');
    expect(tex).toContain('\\toprule');
    expect(tex).toContain('c-Moll & Es \\textperiodcentered{} c & 0 & 41 & 35\\,\\% &');
    expect(tex).toMatch(/\\begin\{tabular\}\{llrrrrrrr\}/);
    expect(toLatex(tables.keys)).not.toContain('\\begin{table}');
  });
  it('escapes LaTeX special characters', () => {
    expect(latexEscape('50 % & $5_{a}$ #1 ~ ^ \\')).toBe('50\\,\\% \\& \\$5\\_\\{a\\}\\$ \\#1 \\textasciitilde{} \\textasciicircum{} \\textbackslash{}');
    expect(latexEscape('„Thema“ – 1−2')).toBe('\\quotedblbase{}Thema\\textquotedblleft{} -- 1$-$2');
  });
  it('exports the analysis as documented JSON', () => {
    const json = analysisJson(p, stats, new Date('2026-10-20T08:00:00Z')) as Record<string, any>;
    expect(json.format).toBe('tonartenverlauf-analysis');
    expect(json.version).toBe(1);
    expect(json.homeKey).toEqual({ name: 'c', fifths: 0, mode: 'minor', row: -3 });
    expect(json.segments[0]).toMatchObject({ from: 1, to: 9, kind: 'key', key: { name: 'c', distance: 0 } });
    expect(json.segments.length).toBe(p.segments.length);
    expect(json.passingChords[0].pos).toBe(74.5);
    expect(json.events[1]).toEqual({ kind: 'section', pos: 38, name: 'Durchführung' });
    expect(json.conventions.distanceMeasure).toBe('rows');
    expect(JSON.parse(JSON.stringify(json))).toEqual(json);
    expect(json.style).toBeUndefined();
  });
});
