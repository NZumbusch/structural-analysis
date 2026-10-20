import * as opentype from 'opentype.js';
import { FAMILY_NAME, fontFile, type Subset, type Weight } from '../render/fonts';
import { HATCH_SIZE } from '../render/hatch';
import { loadFont, fontBytes, parseAttrs, svgFamily, unescapeXml, woffToSfnt } from './fontdata';

/*
 * A small PDF writer for the SVG that our own chart code produces (rect, line, circle, polyline, path,
 * text, groups with transform or clip, hatch patterns). Text becomes real text in embedded TrueType fonts
 * (selectable and searchable); everything else is vector. It is not a general SVG converter.
 */

// ---- a tiny XML reader for our own markup -------------------------------------------------------------------

interface XNode {
  tag: string;
  attrs: Record<string, string>;
  children: (XNode | string)[];
}

function parseXml(src: string): XNode {
  const root: XNode = { tag: '#root', attrs: {}, children: [] };
  const stack: XNode[] = [root];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<(\/?)([\w:-]+)([^>]*?)(\/?)>|([^<]+)/g;
  for (const m of src.matchAll(re)) {
    const top = stack[stack.length - 1];
    if (m[5] !== undefined) {
      if (m[5].trim() || top.tag === 'text') top.children.push(unescapeXml(m[5]));
    } else if (m[2]) {
      if (m[1]) stack.pop();
      else {
        const node: XNode = { tag: m[2], attrs: parseAttrs(m[3]), children: [] };
        top.children.push(node);
        if (!m[4]) stack.push(node);
      }
    }
  }
  return root.children.find((c): c is XNode => typeof c !== 'string')!;
}

// ---- colour and number helpers -----------------------------------------------------------------------------------

const NAMED: Record<string, string> = { white: '#ffffff', black: '#000000' };

function color(value: string | undefined): [number, number, number] | null {
  if (!value || value === 'none' || value === 'transparent') return null;
  let v = NAMED[value] ?? value;
  if (/^#[0-9a-f]{3}$/i.test(v)) v = '#' + [...v.slice(1)].map((c) => c + c).join('');
  const m = v.match(/^#([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const f = (n: number) => (Math.abs(n) < 1e-9 ? '0' : String(Math.round(n * 1000) / 1000));
const rgb = (c: [number, number, number]) => c.map(f).join(' ');
const nums = (s: string) => (s.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);

type Matrix = [number, number, number, number, number, number];

function parseTransform(value: string | undefined): Matrix | null {
  if (!value) return null;
  let m: Matrix = [1, 0, 0, 1, 0, 0];
  const mul = (a: Matrix, b: Matrix): Matrix => [
    a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
  ];
  for (const part of value.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const a = nums(part[2]);
    let t: Matrix = [1, 0, 0, 1, 0, 0];
    if (part[1] === 'translate') t = [1, 0, 0, 1, a[0], a[1] ?? 0];
    else if (part[1] === 'scale') t = [a[0], 0, 0, a[1] ?? a[0], 0, 0];
    else if (part[1] === 'matrix') t = a.slice(0, 6) as Matrix;
    else if (part[1] === 'rotate') {
      const r = (a[0] * Math.PI) / 180;
      t = [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
    } else if (part[1] === 'skewX') t = [1, 0, Math.tan((a[0] * Math.PI) / 180), 1, 0, 0];
    m = mul(m, t);
  }
  return m;
}

// ---- fonts -------------------------------------------------------------------------------------------------------------

interface PdfFont {
  key: string;
  name: string;
  weight: Weight;
  subset: Subset;
  font: opentype.Font;
  /** used glyph id -> code point */
  used: Map<number, number>;
  id: number;
}

// ---- writer ---------------------------------------------------------------------------------------------------------------

class Writer {
  private chunks: Uint8Array[] = [];
  private offsets: number[] = [];
  private length = 0;
  private enc = new TextEncoder();
  count = 0;

  private push(data: Uint8Array | string) {
    const d = typeof data === 'string' ? this.enc.encode(data) : data;
    this.chunks.push(d);
    this.length += d.length;
  }

  start() {
    this.push('%PDF-1.5\n%âãÏÓ\n');
  }

  /** Reserves an object number. */
  reserve(): number {
    return ++this.count;
  }

  object(id: number, body: string) {
    this.offsets[id] = this.length;
    this.push(`${id} 0 obj\n${body}\nendobj\n`);
  }

  async stream(id: number, dict: string, data: Uint8Array, compress = true) {
    const body = compress ? await deflate(data) : data;
    this.offsets[id] = this.length;
    this.push(`${id} 0 obj\n<< ${dict}${compress ? ' /Filter /FlateDecode' : ''} /Length ${body.length} >>\nstream\n`);
    this.push(body);
    this.push('\nendstream\nendobj\n');
  }

  finish(rootId: number, infoId: number): Uint8Array {
    const xref = this.length;
    let out = `xref\n0 ${this.count + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= this.count; i++) out += `${String(this.offsets[i] ?? 0).padStart(10, '0')} 00000 n \n`;
    out += `trailer\n<< /Size ${this.count + 1} /Root ${rootId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    this.push(out);
    const all = new Uint8Array(this.length);
    let pos = 0;
    for (const c of this.chunks) {
      all.set(c, pos);
      pos += c.length;
    }
    return all;
  }
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const hex16 = (n: number) => n.toString(16).padStart(4, '0');
const pdfString = (s: string) => '<FEFF' + [...s].map((c) => hex16(c.charCodeAt(0))).join('') + '>';

export interface PdfOptions {
  /** Width of the page in cm (the chart is scaled to it); default: 96 dpi. */
  widthCm?: number;
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  date?: Date;
}

/** Converts the SVG of a chart into a PDF file. */
export async function svgToPdf(svg: string, options: PdfOptions = {}): Promise<Uint8Array> {
  const root = parseXml(svg);
  const vb = nums(root.attrs.viewBox ?? '');
  const [vw, vh] = [vb[2], vb[3]];
  const pageW = options.widthCm ? (options.widthCm / 2.54) * 72 : vw * 0.75;
  const scale = pageW / vw;
  const pageH = vh * scale;
  const family = svgFamily(svg);

  // preload the fonts we may need
  const fontSets: Record<string, PdfFont> = {};
  const loaded = new Map<string, opentype.Font>();
  for (const w of [400, 500] as Weight[]) {
    for (const sub of ['latin', 'latin-ext'] as Subset[]) loaded.set(`${w}:${sub}`, await loadFont(fontFile(family, w, sub)));
  }
  const pdfFont = (weight: Weight, subset: Subset): PdfFont => {
    const key = `${weight}:${subset}`;
    return (fontSets[key] ??= {
      key, weight, subset, name: `F${Object.keys(fontSets).length + 1}`,
      font: loaded.get(key)!, used: new Map(), id: 0,
    });
  };

  // definitions: clip paths and the hatch pattern
  const clips = new Map<string, Record<string, string>>();
  const patterns = new Map<string, { bg: string; line: string; width: number; size: number; angle: number }>();
  const collect = (n: XNode) => {
    if (n.tag === 'clipPath') {
      const r = n.children.find((c): c is XNode => typeof c !== 'string' && c.tag === 'rect');
      if (r) clips.set(n.attrs.id, r.attrs);
    } else if (n.tag === 'pattern') {
      const bg = n.children.find((c): c is XNode => typeof c !== 'string' && c.tag === 'rect');
      const ln = n.children.find((c): c is XNode => typeof c !== 'string' && c.tag === 'line');
      patterns.set(n.attrs.id, {
        bg: bg?.attrs.fill ?? '#ffffff', line: ln?.attrs.stroke ?? '#000000', width: parseFloat(ln?.attrs['stroke-width'] ?? '1'),
        size: parseFloat(n.attrs.width ?? String(HATCH_SIZE)), angle: nums(n.attrs.patternTransform ?? '')[0] ?? 0,
      });
    }
    for (const c of n.children) if (typeof c !== 'string') collect(c);
  };
  collect(root);

  // ---- drawing --------------------------------------------------------------------------------------------------
  const ops: string[] = [];
  const alphas = new Map<string, string>();
  const gs = (ca: number, CA: number): string => {
    const key = `${f(ca)} ${f(CA)}`;
    if (!alphas.has(key)) alphas.set(key, `G${alphas.size + 1}`);
    return `/${alphas.get(key)} gs`;
  };

  const roundedRect = (x: number, y: number, w: number, h: number, r: number): string => {
    if (r <= 0) return `${f(x)} ${f(y)} ${f(w)} ${f(h)} re`;
    r = Math.min(r, w / 2, h / 2);
    const k = r * 0.5523;
    return [
      `${f(x + r)} ${f(y)} m`, `${f(x + w - r)} ${f(y)} l`,
      `${f(x + w - r + k)} ${f(y)} ${f(x + w)} ${f(y + r - k)} ${f(x + w)} ${f(y + r)} c`,
      `${f(x + w)} ${f(y + h - r)} l`,
      `${f(x + w)} ${f(y + h - r + k)} ${f(x + w - r + k)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)} c`,
      `${f(x + r)} ${f(y + h)} l`,
      `${f(x + r - k)} ${f(y + h)} ${f(x)} ${f(y + h - r + k)} ${f(x)} ${f(y + h - r)} c`,
      `${f(x)} ${f(y + r)} l`,
      `${f(x)} ${f(y + r - k)} ${f(x + r - k)} ${f(y)} ${f(x + r)} ${f(y)} c`, 'h',
    ].join('\n');
  };

  const circlePath = (cx: number, cy: number, r: number) => {
    const k = r * 0.5523;
    return [
      `${f(cx + r)} ${f(cy)} m`,
      `${f(cx + r)} ${f(cy + k)} ${f(cx + k)} ${f(cy + r)} ${f(cx)} ${f(cy + r)} c`,
      `${f(cx - k)} ${f(cy + r)} ${f(cx - r)} ${f(cy + k)} ${f(cx - r)} ${f(cy)} c`,
      `${f(cx - r)} ${f(cy - k)} ${f(cx - k)} ${f(cy - r)} ${f(cx)} ${f(cy - r)} c`,
      `${f(cx + k)} ${f(cy - r)} ${f(cx + r)} ${f(cy - k)} ${f(cx + r)} ${f(cy)} c`, 'h',
    ].join('\n');
  };

  const pathData = (d: string): string => {
    const out: string[] = [];
    let cx = 0;
    let cy = 0;
    let sx = 0;
    let sy = 0;
    for (const m of d.matchAll(/([MLHVCZQ])([^MLHVCZQ]*)/g)) {
      const a = nums(m[2]);
      switch (m[1]) {
        case 'M': cx = a[0]; cy = a[1]; sx = cx; sy = cy; out.push(`${f(cx)} ${f(cy)} m`);
          for (let i = 2; i + 1 < a.length; i += 2) { cx = a[i]; cy = a[i + 1]; out.push(`${f(cx)} ${f(cy)} l`); }
          break;
        case 'L': for (let i = 0; i + 1 < a.length; i += 2) { cx = a[i]; cy = a[i + 1]; out.push(`${f(cx)} ${f(cy)} l`); } break;
        case 'H': for (const x of a) { cx = x; out.push(`${f(cx)} ${f(cy)} l`); } break;
        case 'V': for (const y of a) { cy = y; out.push(`${f(cx)} ${f(cy)} l`); } break;
        case 'C': for (let i = 0; i + 5 < a.length; i += 6) { out.push(`${a.slice(i, i + 6).map(f).join(' ')} c`); cx = a[i + 4]; cy = a[i + 5]; } break;
        case 'Q': // quadratic -> cubic (outlined text uses quadratics)
          for (let i = 0; i + 3 < a.length; i += 4) {
            const [qx, qy, x, y] = a.slice(i, i + 4);
            out.push(`${f(cx + (2 / 3) * (qx - cx))} ${f(cy + (2 / 3) * (qy - cy))} ${f(x + (2 / 3) * (qx - x))} ${f(y + (2 / 3) * (qy - y))} ${f(x)} ${f(y)} c`);
            cx = x; cy = y;
          }
          break;
        case 'Z': out.push('h'); cx = sx; cy = sy; break;
      }
    }
    return out.join('\n');
  };

  /** Fill, hatch and stroke of one shape. `bbox` is needed for the hatch pattern. */
  const paint = (a: Record<string, string>, path: string, bbox?: [number, number, number, number]) => {
    const op = parseFloat(a.opacity ?? '1');
    const fillOp = op * parseFloat(a['fill-opacity'] ?? '1');
    const strokeOp = op * parseFloat(a['stroke-opacity'] ?? '1');
    const fillRaw = a.fill ?? 'black';
    const pattern = fillRaw.startsWith('url(#') ? patterns.get(fillRaw.slice(5, -1)) : undefined;
    const fill = pattern ? color(pattern.bg) : color(fillRaw);
    const stroke = color(a.stroke);

    if (fill) ops.push(`q ${gs(fillOp, fillOp)} ${rgb(fill)} rg\n${path}\nf\nQ`);
    if (pattern && bbox) {
      const [bx, by, bw, bh] = bbox;
      const th = (pattern.angle * Math.PI) / 180;
      const cos = Math.cos(th);
      const sin = Math.sin(th);
      const corners = [[bx, by], [bx + bw, by], [bx, by + bh], [bx + bw, by + bh]].map(([x, y]) => [x * cos + y * sin, -x * sin + y * cos]);
      const xs = corners.map((c) => c[0]);
      const ys = corners.map((c) => c[1]);
      const lines: string[] = [];
      for (let k = Math.floor((Math.min(...xs) - pattern.size / 2) / pattern.size); k <= Math.ceil(Math.max(...xs) / pattern.size); k++) {
        const x = k * pattern.size + pattern.size / 2;
        const p1 = [x * cos - Math.min(...ys) * sin, x * sin + Math.min(...ys) * cos];
        const p2 = [x * cos - Math.max(...ys) * sin, x * sin + Math.max(...ys) * cos];
        lines.push(`${f(p1[0])} ${f(p1[1])} m ${f(p2[0])} ${f(p2[1])} l S`);
      }
      const lc = color(pattern.line)!;
      ops.push(`q ${gs(fillOp, fillOp)} ${path}\nW n ${rgb(lc)} RG ${f(pattern.width)} w\n${lines.join('\n')}\nQ`);
    }
    if (stroke) {
      const dash = nums(a['stroke-dasharray'] ?? '');
      const cap = a['stroke-linecap'] === 'round' ? 1 : 0;
      const join = a['stroke-linejoin'] === 'round' ? 1 : 0;
      ops.push(
        `q ${gs(strokeOp, strokeOp)} ${rgb(stroke)} RG ${f(parseFloat(a['stroke-width'] ?? '1'))} w ${cap} J ${join} j` +
          (dash.length ? ` [${dash.map(f).join(' ')}] 0 d` : '') +
          `\n${path}\nS\nQ`,
      );
    }
  };

  const drawText = (a: Record<string, string>, content: string) => {
    const size = parseFloat(a['font-size'] ?? '12');
    const x = parseFloat(a.x ?? '0');
    let y = parseFloat(a.y ?? '0');
    if (a.dy?.endsWith('em')) y += parseFloat(a.dy) * size;
    const weight: Weight = parseInt(a['font-weight'] ?? '400', 10) >= 500 ? 500 : 400;
    const fillC = color(a.fill) ?? [0, 0, 0];
    const runs: { pf: PdfFont; gids: number[]; width: number }[] = [];
    for (const ch of content) {
      const cp = ch.codePointAt(0)!;
      const subset: Subset | null = loaded.get(`${weight}:latin`)!.charToGlyphIndex(ch) > 0 ? 'latin' : loaded.get(`${weight}:latin-ext`)!.charToGlyphIndex(ch) > 0 ? 'latin-ext' : null;
      if (!subset) continue;
      const pf = pdfFont(weight, subset);
      const gid = pf.font.charToGlyphIndex(ch);
      pf.used.set(gid, cp);
      const adv = (pf.font.glyphs.get(gid).advanceWidth * 1000) / pf.font.unitsPerEm;
      const last = runs[runs.length - 1];
      if (last && last.pf === pf) {
        last.gids.push(gid);
        last.width += adv;
      } else runs.push({ pf, gids: [gid], width: adv });
    }
    const total = runs.reduce((s, r) => s + r.width, 0) * (size / 1000);
    let cursor = x - (a['text-anchor'] === 'middle' ? total / 2 : a['text-anchor'] === 'end' ? total : 0);
    const skew = a['font-style'] === 'italic' ? 0.2 : 0;
    for (const r of runs) {
      ops.push(
        `q ${gs(parseFloat(a['fill-opacity'] ?? '1'), 1)} ${rgb(fillC)} rg BT /${r.pf.name} ${f(size)} Tf 1 0 ${skew} -1 ${f(cursor)} ${f(y)} Tm <${r.gids.map(hex16).join('')}> Tj ET Q`,
      );
      cursor += r.width * (size / 1000);
    }
  };

  const walk = (n: XNode) => {
    const a = n.attrs;
    const tr = parseTransform(a.transform);
    const clipId = a['clip-path']?.match(/url\(#([^)]+)\)/)?.[1];
    const clip = clipId ? clips.get(clipId) : undefined;
    const wrap = !!tr || !!clip;
    if (wrap) ops.push('q');
    if (tr) ops.push(`${tr.map((v) => f(v)).join(' ')} cm`);
    if (clip) ops.push(`${f(parseFloat(clip.x))} ${f(parseFloat(clip.y))} ${f(parseFloat(clip.width))} ${f(parseFloat(clip.height))} re W n`);

    switch (n.tag) {
      case 'rect': {
        const [x, y, w, h] = [a.x, a.y, a.width, a.height].map((v) => parseFloat(v ?? '0'));
        if (w > 0 && h > 0) paint(a, roundedRect(x, y, w, h, parseFloat(a.rx ?? '0')), [x, y, w, h]);
        break;
      }
      case 'line': {
        const d = `${f(parseFloat(a.x1))} ${f(parseFloat(a.y1))} m ${f(parseFloat(a.x2))} ${f(parseFloat(a.y2))} l`;
        paint({ ...a, fill: 'none' }, d);
        break;
      }
      case 'circle': paint(a, circlePath(parseFloat(a.cx), parseFloat(a.cy), parseFloat(a.r))); break;
      case 'polyline': {
        const p = nums(a.points ?? '');
        let d = '';
        for (let i = 0; i + 1 < p.length; i += 2) d += `${f(p[i])} ${f(p[i + 1])} ${i === 0 ? 'm' : 'l'}\n`;
        paint({ ...a, fill: a.fill ?? 'none' }, d);
        break;
      }
      case 'path': paint(a, pathData(a.d ?? '')); break;
      case 'text': drawText(a, n.children.filter((c): c is string => typeof c === 'string').join('')); break;
      case 'defs': case 'clipPath': case 'pattern': case 'style': case 'title': case 'desc': break;
      default:
        for (const c of n.children) if (typeof c !== 'string') walk(c);
    }
    if (wrap) ops.push('Q');
  };

  const bgRect = root.children.find((c): c is XNode => typeof c !== 'string' && c.tag === 'rect' && !c.attrs.x && !c.attrs.rx);
  void bgRect;
  for (const c of root.children) if (typeof c !== 'string') walk(c);

  // ---- assemble the file -----------------------------------------------------------------------------------------------
  const w = new Writer();
  w.start();
  const catalog = w.reserve();
  const pages = w.reserve();
  const page = w.reserve();
  const contents = w.reserve();
  const info = w.reserve();

  const fontRefs: string[] = [];
  for (const pf of Object.values(fontSets)) {
    const type0 = w.reserve();
    const cid = w.reserve();
    const desc = w.reserve();
    const file = w.reserve();
    const uni = w.reserve();
    pf.id = type0;
    fontRefs.push(`/${pf.name} ${type0} 0 R`);
    const upm = pf.font.unitsPerEm;
    const k = 1000 / upm;
    const head = pf.font.tables.head;
    const baseName = `${FAMILY_NAME[family].replace(/\s+/g, '')}-${pf.weight === 500 ? 'Medium' : 'Regular'}${pf.subset === 'latin-ext' ? 'Ext' : ''}`;
    const gids = [...pf.used.keys()].sort((a, b) => a - b);
    const widths = gids.map((g) => `${g} [${f(pf.font.glyphs.get(g).advanceWidth * k)}]`).join(' ');
    w.object(type0, `<< /Type /Font /Subtype /Type0 /BaseFont /${baseName} /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${uni} 0 R >>`);
    w.object(cid, `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${baseName} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${desc} 0 R /DW 1000 /W [${widths}] /CIDToGIDMap /Identity >>`);
    w.object(
      desc,
      `<< /Type /FontDescriptor /FontName /${baseName} /Flags 32 /FontBBox [${[head.xMin, head.yMin, head.xMax, head.yMax].map((v: number) => f(v * k)).join(' ')}] /ItalicAngle 0 /Ascent ${f(pf.font.ascender * k)} /Descent ${f(pf.font.descender * k)} /CapHeight ${f((pf.font.tables.os2?.sCapHeight ?? pf.font.ascender * 0.7) * k)} /StemV 80 /FontFile2 ${file} 0 R >>`,
    );
    const ttf = await woffToSfnt(await fontBytes(fontFile(family, pf.weight, pf.subset)));
    await w.stream(file, `/Length1 ${ttf.length}`, ttf);
    const entries = gids.map((g) => `<${hex16(g)}> <${[...String.fromCodePoint(pf.used.get(g)!)].map((c) => hex16(c.charCodeAt(0))).join('')}>`);
    let cmap = '/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /Adobe-Identity-UCS def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange\n';
    for (let i = 0; i < entries.length; i += 100) cmap += `${Math.min(100, entries.length - i)} beginbfchar\n${entries.slice(i, i + 100).join('\n')}\nendbfchar\n`;
    cmap += 'endcmap CMapName currentdict /CMap defineresource pop end end';
    await w.stream(uni, '', new TextEncoder().encode(cmap));
  }

  const gsDict = [...alphas].map(([key, name]) => `/${name} << /ca ${key.split(' ')[0]} /CA ${key.split(' ')[1]} >>`).join(' ');
  const stream = `q ${f(scale)} 0 0 ${f(-scale)} 0 ${f(pageH)} cm\n${ops.join('\n')}\nQ\n`;
  await w.stream(contents, '', new TextEncoder().encode(stream));
  w.object(page, `<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${f(pageW)} ${f(pageH)}] /Contents ${contents} 0 R /Resources << /Font << ${fontRefs.join(' ')} >> /ExtGState << ${gsDict} >> >> >>`);
  w.object(pages, `<< /Type /Pages /Kids [${page} 0 R] /Count 1 >>`);
  w.object(catalog, `<< /Type /Catalog /Pages ${pages} 0 R >>`);
  const pdfDate = (d: Date) => `(D:${d.toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z)`;
  w.object(
    info,
    `<< /Title ${pdfString(options.title ?? 'Tonartenverlauf')} /Producer ${pdfString('Tonartenverlauf')} /Creator ${pdfString(options.creator ?? 'Tonartenverlauf')}` +
      (options.author ? ` /Author ${pdfString(options.author)}` : '') +
      (options.subject ? ` /Subject ${pdfString(options.subject)}` : '') +
      (options.date ? ` /CreationDate ${pdfDate(options.date)}` : '') +
      ' >>',
  );
  return w.finish(catalog, info);
}
