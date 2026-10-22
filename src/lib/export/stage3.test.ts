import * as opentype from 'opentype.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { useNodeFonts } from '../../test/fonts';
import { buildAltText } from '../analysis/caption';
import { chartDistance, chartKeys } from '../analysis/charts';
import { computeStats } from '../analysis/stats';
import { createExample } from '../domain/example';
import { makeEvent } from '../domain/structure';
import { renderChart } from '../render/chart';
import { toCmyk } from '../render/colors';
import { fontFile } from '../render/fonts';
import { embedFonts, fontBytes, outlineText, subsetsFor, woffToSfnt } from './fontdata';
import { fitFontScale, labelPoints } from './fit';
import { svgToPdf } from './pdf';

beforeAll(() => useNodeFonts());

describe('fonts in exports', () => {
  it('embeds only the subsets and weights the figure needs', async () => {
    const svg = renderChart(createExample()).svg;
    const embedded = await embedFonts(svg);
    expect(embedded).toContain('@font-face');
    expect(embedded).toContain('data:font/woff;base64,');
    expect(embedded).toContain("font-family:'Inter'");
    expect(embedded.match(/@font-face/g)).toHaveLength(2); // 400 and 500, latin only
    expect(embedded).not.toContain('U+0100-02BA');
    const p = createExample();
    p.meta.title = 'Dvořák';
    expect((await embedFonts(renderChart(p).svg)).match(/@font-face/g)).toHaveLength(4);
    expect(subsetsFor('Haydn · Klaviersonate')).toEqual(['latin']);
    expect(subsetsFor('Janáček ř')).toEqual(['latin', 'latin-ext']);
  });
  it('follows the chosen font family', async () => {
    const p = createExample();
    p.style.fontFamily = 'serif';
    expect(await embedFonts(renderChart(p).svg)).toContain("font-family:'Source Serif 4'");
  });
  it('turns text into outlines', async () => {
    const svg = renderChart(createExample()).svg;
    const { svg: out, missing } = await outlineText(svg);
    expect(missing).toBe(0);
    expect(out).not.toContain('<text');
    expect(out).toContain('<path d="M');
    expect(out.length).toBeGreaterThan(svg.length);
    const odd = await outlineText('<svg font-family="\'Inter\'"><text x="1" y="1" font-size="10" fill="#000">a♭b</text></svg>');
    expect(odd.missing).toBe(1);
    expect(odd.svg).toContain('<text');
  });
  it('unpacks WOFF into a font file that parses again', async () => {
    const sfnt = await woffToSfnt(await fontBytes(fontFile('sans', 400, 'latin')));
    expect(new DataView(sfnt.buffer).getUint32(0)).toBe(0x00010000);
    const font = opentype.parse(sfnt.buffer.slice(sfnt.byteOffset, sfnt.byteOffset + sfnt.byteLength) as ArrayBuffer);
    expect(font.unitsPerEm).toBe(2048);
    expect(font.charToGlyphIndex('A')).toBeGreaterThan(0);
  });
});

describe('pdf', () => {
  it('writes a page of the requested size with embedded fonts', async () => {
    const p = createExample();
    p.style.hatch = true;
    p.events.push(makeEvent('keysig', 30, { fifths: -3 }), makeEvent('fermata', 60.5), makeEvent('marker', 38, { label: 'A' }));
    const chart = renderChart(p);
    const bytes = await svgToPdf(chart.svg, { widthCm: 16, title: 'Titel ä' });
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('%PDF-1.5')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('/CIDFontType2');
    expect(text).toContain('/FontFile2');
    expect(text).toContain('/Inter-Regular');
    const box = text.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/)!;
    expect(parseFloat(box[1])).toBeCloseTo((16 / 2.54) * 72, 1);
    expect(parseFloat(box[2])).toBeCloseTo(((16 / 2.54) * 72 * chart.height) / chart.width, 0);
    // every object listed in the cross-reference table is where it says
    const xref = text.lastIndexOf('xref\n');
    const entries = [...text.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => parseInt(m[1], 10));
    entries.forEach((offset, i) => expect(text.slice(offset, offset + 12)).toMatch(new RegExp(`^${i + 1} 0 obj`)));
  });
  it('writes no fonts for outlined text', async () => {
    const { svg } = await outlineText(renderChart(createExample()).svg);
    const text = new TextDecoder('latin1').decode(await svgToPdf(svg));
    expect(text).not.toContain('/FontFile2');
  });
  it('handles views and the stats charts', async () => {
    const p = createExample();
    const zoom = await svgToPdf(renderChart(p, { view: { from: 70, to: 80 } }).svg);
    expect(zoom.length).toBeGreaterThan(5000);
    const stats = computeStats(p);
    const chart = await svgToPdf(chartKeys(stats, p, 'duration').svg);
    expect(new TextDecoder('latin1').decode(chart)).toContain('/FontFile2');
  });
});

describe('hatching', () => {
  it('adds a pattern for minor bars only when switched on', () => {
    const p = createExample();
    expect(renderChart(p).svg).not.toContain('hatch-minor');
    p.style.hatch = true;
    const svg = renderChart(p).svg;
    expect(svg).toContain('<pattern id="hatch-minor"');
    expect(svg).toContain('fill="url(#hatch-minor)"');
    const stats = computeStats(p);
    expect(chartDistance(stats, p).svg).toContain('url(#hatch-minor)');
  });
});

describe('print size', () => {
  it('finds the font scale that prints the labels at the target size', () => {
    const p = createExample();
    const scale = fitFontScale(p, 16, 8);
    p.style.fontScale = scale;
    expect(labelPoints(p, 16)).toBeCloseTo(8, 0);
    expect(scale).toBeGreaterThan(1);
  });
  it('converts colours to CMYK', () => {
    expect(toCmyk('#000000')).toEqual({ c: 0, m: 0, y: 0, k: 100 });
    expect(toCmyk('#ffffff')).toEqual({ c: 0, m: 0, y: 0, k: 0 });
    expect(toCmyk('#ff0000')).toEqual({ c: 0, m: 100, y: 100, k: 0 });
  });
});

describe('alt text', () => {
  it('describes the figure from the analysis', () => {
    const p = createExample();
    const alt = buildAltText(p);
    expect(alt).toContain('Diagramm zum Tonartenverlauf von Haydn, Klaviersonate c-Moll, 1. Satz');
    expect(alt).toContain('beginnt in c-Moll und endet in c-Moll');
    expect(alt).toContain('as-Moll');
    p.style.language = 'en';
    expect(buildAltText(p)).toContain('Chart of the key plan of Haydn');
    p.meta.altText = 'Eigener Text <b>';
    expect(renderChart(p).svg).toContain('<desc>Eigener Text &lt;b&gt;</desc>');
  });
});
