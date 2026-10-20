import type { DistanceMeasure } from '../domain/distance';
import { keyName, rowLabel } from '../domain/keys';
import type { Key, Lang, Piece } from '../domain/types';
import { esc, FONTS, textWidth } from '../render/chart';
import { formatNumber, formatPercent } from './csv';
import { sectionSpans } from '../domain/structure';
import { type Stats } from './stats';

export interface StatChart {
  svg: string;
  width: number;
  height: number;
}

export type KeyOrder = 'duration' | 'fifths' | 'first';

const TEXT = {
  de: {
    bars: 'Takte',
    keysTitle: 'Dauer der Tonarten',
    distTitle: 'Verteilung nach Entfernung vom Zentrum',
    distAxis: (unit: string) => `Entfernung in ${unit} (− = B-Seite, + = Kreuz-Seite)`,
    profTitle: 'Entfernung vom Zentrum im Verlauf',
    profAxis: (unit: string) => unit.charAt(0).toUpperCase() + unit.slice(1),
    secTitle: 'Entfernung vom Zentrum nach Formteilen',
    major: 'Dur',
    minor: 'Moll',
    dominant: 'Zwischendominante',
    passing: 'Durchgangsakkord',
    noSections: 'Keine Formteile angelegt',
    flat: 'B-Seite',
    sharp: 'Kreuz-Seite',
  },
  en: {
    bars: 'Bars',
    keysTitle: 'Time spent in each key',
    distTitle: 'Distribution by distance from the centre',
    distAxis: (unit: string) => `Distance in ${unit} (− = flat side, + = sharp side)`,
    profTitle: 'Distance from the centre over time',
    profAxis: (unit: string) => unit.charAt(0).toUpperCase() + unit.slice(1),
    secTitle: 'Distance from the centre by section',
    major: 'Major',
    minor: 'Minor',
    dominant: 'Secondary dominant',
    passing: 'Passing chord',
    noSections: 'No sections defined',
    flat: 'flat side',
    sharp: 'sharp side',
  },
} as const;

/** Name of the unit a distance measure counts in. */
export function unitName(measure: DistanceMeasure, lang: Lang): string {
  if (measure === 'steps') return lang === 'de' ? 'Schritten' : 'steps';
  if (measure === 'tonic') return lang === 'de' ? 'Quinten der Grundtöne' : 'fifths of the tonics';
  return lang === 'de' ? 'Quinten' : 'fifths';
}

/** The unit as a plain plural, for labels and legends. */
export function unitPlural(measure: DistanceMeasure, lang: Lang): string {
  if (measure === 'steps') return lang === 'de' ? 'Schritte' : 'steps';
  if (measure === 'tonic') return lang === 'de' ? 'Quinten (Grundtöne)' : 'fifths (tonics)';
  return lang === 'de' ? 'Quinten' : 'fifths';
}

/** 'Es-Dur', 'c-Moll' / 'Eb major', 'c minor'. */
export function keyDisplay(key: Key, piece: Piece): string {
  const name = keyName(key, piece.style.noteNames);
  if (piece.style.language === 'en') return `${name} ${key.mode}`;
  return `${name}-${key.mode === 'major' ? 'Dur' : 'Moll'}`;
}

function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

/** Colour of distance class d (0 = home, lightest) out of `classes`. */
export function classColor(piece: Piece, d: number, classes: number): string {
  const c = piece.style.colors;
  return mix(c.background, c.majorStroke, 0.18 + (0.82 * d) / Math.max(1, classes - 1));
}

function niceStep(max: number, target = 6): number {
  const raw = max / target;
  const base = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 5, 10].map((m) => m * base).find((s) => s >= raw) ?? base * 10;
}

class Canvas {
  parts: string[] = [];
  constructor(
    readonly piece: Piece,
    readonly width: number,
  ) {}
  get c() {
    return this.piece.style.colors;
  }
  get fs() {
    return this.piece.style.fontScale;
  }
  get fam() {
    return this.piece.style.fontFamily;
  }
  text(x: number, y: number, s: string, o: { size?: number; color?: string; anchor?: 'start' | 'middle' | 'end'; weight?: number } = {}) {
    const size = (o.size ?? 12.5) * this.fs;
    this.parts.push(
      `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" dy="0.35em" font-size="${size.toFixed(2)}" fill="${o.color ?? this.c.text}"` +
        (o.anchor && o.anchor !== 'start' ? ` text-anchor="${o.anchor}"` : '') +
        (o.weight ? ` font-weight="${o.weight}"` : '') +
        `>${esc(s)}</text>`,
    );
  }
  tw(s: string, size = 12.5) {
    return textWidth(s, size * this.fs, this.fam);
  }
  line(x1: number, y1: number, x2: number, y2: number, color: string, w = 1, extra = '') {
    this.parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="${w}"${extra}/>`);
  }
  rect(x: number, y: number, w: number, h: number, fill: string, stroke = 'none', sw = 1, extra = '') {
    this.parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(0, w).toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${extra}/>`);
  }
  finish(height: number, title: string): StatChart {
    const bg = this.piece.style.transparentBackground ? '' : `<rect width="${this.width}" height="${height}" fill="${this.c.background}"/>`;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${height}" viewBox="0 0 ${this.width} ${height}" font-family="${esc(FONTS[this.fam])}" role="img" aria-label="${esc(title)}">` +
      `<title>${esc(title)}</title>${bg}${this.parts.join('')}</svg>`;
    return { svg, width: this.width, height };
  }
}

function header(cv: Canvas, title: string, subtitle?: string) {
  cv.text(24, 28, title, { size: 17, weight: 500 });
  if (subtitle) cv.text(24, 50, subtitle, { size: 12.5, color: cv.c.muted });
}

function legend(cv: Canvas, y: number, items: { label: string; draw: (x: number, y: number) => void }[]) {
  let x = 24;
  for (const it of items) {
    it.draw(x, y);
    cv.text(x + 30, y, it.label, { size: 12 });
    x += 30 + cv.tw(it.label, 12) + 26;
  }
}

const modeSwatch = (cv: Canvas, mode: 'major' | 'minor') => (x: number, y: number) =>
  cv.rect(x, y - 6, 22, 12, mode === 'major' ? cv.c.majorFill : cv.c.minorFill, mode === 'major' ? cv.c.majorStroke : cv.c.minorStroke, 1.2, ' rx="3"');
const domSwatch = (cv: Canvas) => (x: number, y: number) =>
  cv.rect(x, y - 6, 22, 12, cv.c.surface, cv.c.majorStroke, 1.4, ' rx="3" stroke-dasharray="3 2.4"');

// ---- 1. time per key --------------------------------------------------------------------------------------
export function chartKeys(stats: Stats, piece: Piece, order: KeyOrder): StatChart {
  const lang = piece.style.language as Lang;
  const L = TEXT[lang];
  const cv = new Canvas(piece, 760);
  const rows = [...stats.keys];
  if (order === 'fifths') rows.sort((a, b) => b.row - a.row || (a.key.mode === 'major' ? -1 : 1));
  if (order === 'first') rows.sort((a, b) => a.first - b.first);
  const labelW = Math.max(60, ...rows.map((r) => cv.tw(keyDisplay(r.key, piece), 12.5))) + 12;
  const left = 24 + labelW;
  const right = 760 - 120;
  const top = 74;
  const rowH = 26;
  const max = Math.max(1, ...rows.map((r) => r.bars));
  const step = niceStep(max);
  const xmax = Math.ceil(max / step) * step;
  const x = (v: number) => left + ((right - left) * v) / xmax;
  header(cv, L.keysTitle, piece.meta.title ? [piece.meta.composer, piece.meta.title].filter(Boolean).join(' · ') : undefined);

  const bottom = top + rows.length * rowH;
  for (let v = 0; v <= xmax + 1e-9; v += step) {
    cv.line(x(v), top - 6, x(v), bottom, cv.c.grid, 0.7, ' stroke-dasharray="1.4 2.1"');
    cv.text(x(v), bottom + 14, String(v), { size: 12, color: cv.c.muted, anchor: 'middle' });
  }
  cv.text(left - 6, bottom + 14, L.bars, { size: 12, color: cv.c.muted, anchor: 'end' });
  rows.forEach((r, i) => {
    const y = top + i * rowH + rowH / 2;
    const fill = r.key.mode === 'major' ? cv.c.majorFill : cv.c.minorFill;
    const stroke = r.key.mode === 'major' ? cv.c.majorStroke : cv.c.minorStroke;
    const isHome = r.distance === 0;
    cv.text(left - 8, y, keyDisplay(r.key, piece), { anchor: 'end', color: isHome ? cv.c.text : cv.c.muted, weight: isHome ? 500 : 0 });
    if (r.established > 0) cv.rect(x(0), y - 8, x(r.established) - x(0), 16, fill, stroke, 1.2, ' rx="4"');
    if (r.dominant > 0) cv.rect(x(r.established) + 0.5, y - 7.5, x(r.dominant) - x(0) - 1, 15, cv.c.surface, stroke, 1.4, ' rx="4" stroke-dasharray="3 2.4"');
    cv.text(x(r.bars) + 8, y, `${formatNumber(r.bars, lang, 1)} · ${formatPercent(r.share, lang)}`, { size: 11.5, color: cv.c.muted });
  });
  const ly = bottom + 44;
  legend(cv, ly, [
    { label: L.major, draw: modeSwatch(cv, 'major') },
    { label: L.minor, draw: modeSwatch(cv, 'minor') },
    { label: L.dominant, draw: domSwatch(cv) },
  ]);
  return cv.finish(ly + 26, L.keysTitle);
}

// ---- 2. distribution by distance ---------------------------------------------------------------------------------
export function chartDistance(stats: Stats, piece: Piece): StatChart {
  const lang = piece.style.language as Lang;
  const L = TEXT[lang];
  const ds = stats.distances;
  const colW = 54;
  const left = 70;
  const width = Math.max(560, left + ds.length * colW + 40);
  const cv = new Canvas(piece, width);
  const top = 80;
  const plotH = 230;
  const max = Math.max(1, ...ds.map((d) => d.bars));
  const step = niceStep(max, 5);
  const ymax = Math.ceil(max / step) * step;
  const y = (v: number) => top + plotH - (plotH * v) / ymax;
  header(cv, L.distTitle);

  for (let v = 0; v <= ymax + 1e-9; v += step) {
    cv.line(left, y(v), left + ds.length * colW, y(v), cv.c.grid, 0.7, ' stroke-dasharray="1.4 2.1"');
    cv.text(left - 8, y(v), String(v), { size: 12, color: cv.c.muted, anchor: 'end' });
  }
  cv.text(left - 8, top - 18, L.bars, { size: 12, color: cv.c.muted, anchor: 'end' });
  ds.forEach((d, i) => {
    const x = left + i * colW;
    if (d.signed === 0) cv.rect(x, top - 6, colW, plotH + 54, cv.c.centerBand, 'none', 0, ' opacity="0.8"');
  });
  ds.forEach((d, i) => {
    const x = left + i * colW + 9;
    const w = colW - 18;
    // minor sits on top of major
    if (d.major > 0) cv.rect(x, y(d.major), w, y(0) - y(d.major), cv.c.majorFill, cv.c.majorStroke, 1.2, ' rx="3"');
    if (d.minor > 0) cv.rect(x, y(d.major + d.minor), w, y(d.major) - y(d.major + d.minor), cv.c.minorFill, cv.c.minorStroke, 1.2, ' rx="3"');
    if (d.bars > 0) cv.text(x + w / 2, y(d.bars) - 10, formatNumber(d.bars, lang, 1), { size: 11.5, color: cv.c.muted, anchor: 'middle' });
    const cx = x + w / 2;
    const sign = d.signed > 0 ? `+${d.signed}` : d.signed < 0 ? `−${-d.signed}` : '0';
    cv.text(cx, top + plotH + 16, sign, { anchor: 'middle', weight: d.signed === 0 ? 500 : 0 });
    if (stats.measure === 'rows') {
      cv.text(cx, top + plotH + 33, rowLabel(stats.centerRow + d.signed, piece.style.noteNames, piece.style.enharmonic), { size: 10.5, color: cv.c.muted, anchor: 'middle' });
    }
  });
  cv.line(left, y(0), left + ds.length * colW, y(0), cv.c.axis, 1.1);
  cv.text(left, top + plotH + 58, L.distAxis(unitName(stats.measure, lang)), { size: 12, color: cv.c.muted });
  const ly = top + plotH + 90;
  legend(cv, ly, [
    { label: L.major, draw: modeSwatch(cv, 'major') },
    { label: L.minor, draw: modeSwatch(cv, 'minor') },
  ]);
  return cv.finish(ly + 26, L.distTitle);
}

// ---- 3. distance over time -------------------------------------------------------------------------------------------
export function chartProfile(stats: Stats, piece: Piece, signed: boolean): StatChart {
  const lang = piece.style.language as Lang;
  const L = TEXT[lang];
  const cv = new Canvas(piece, 760);
  const left = 70;
  const right = 760 - 30;
  const top = 86;
  const plotH = 220;
  const endBar = Math.max(2, stats.summary.pieceBars + 1);
  const x = (bar: number) => left + ((right - left) * (bar - 1)) / (endBar - 1);
  const vals = stats.profile.map((p) => (signed ? p.signed : Math.abs(p.signed)));
  const passing = stats.piece.passing.map((p) => ({ pos: p.pos, v: rowOfSigned(p.key, stats, signed) }));
  const all = [...vals, ...passing.map((p) => p.v), 0];
  let lo = Math.min(...all);
  let hi = Math.max(...all, signed ? 1 : 2);
  if (signed) lo = Math.min(lo, -1);
  const yv = (v: number) => top + plotH - (plotH * (v - lo)) / (hi - lo);
  header(cv, L.profTitle);

  const tick = (hi - lo) > 8 ? 2 : 1;
  for (let v = Math.ceil(lo / tick) * tick; v <= hi; v += tick) {
    cv.line(left, yv(v), right, yv(v), v === 0 ? cv.c.axis : cv.c.grid, v === 0 ? 1 : 0.7, v === 0 ? '' : ' stroke-dasharray="1.4 2.1"');
    cv.text(left - 8, yv(v), v > 0 && signed ? `+${v}` : v < 0 ? `−${-v}` : String(v), { size: 12, color: cv.c.muted, anchor: 'end', weight: v === 0 ? 500 : 0 });
  }
  cv.text(left - 8, top - 22, L.profAxis(unitPlural(stats.measure, lang)), { size: 12, color: cv.c.muted, anchor: 'end' });

  // sections
  const secs = sectionSpans(stats.piece).filter((sp) => sp.id);
  secs.forEach((s) => {
    const end = Math.min(s.to, endBar);
    if (s.from > 1) cv.line(x(s.from), top - 8, x(s.from), top + plotH, cv.c.grid, 1.1);
    if (s.name.trim()) cv.text((x(s.from) + x(end)) / 2, top - 22, s.name, { size: 13, anchor: 'middle', weight: 500 });
  });

  // step path
  const base = yv(Math.max(lo, 0));
  let d = '';
  let area = '';
  const dashes: string[] = [];
  stats.profile.forEach((p, i) => {
    const v = signed ? p.signed : Math.abs(p.signed);
    const prev = stats.profile[i - 1];
    const touching = prev && Math.abs(prev.to - p.from) < 1e-9;
    const pv = prev ? (signed ? prev.signed : Math.abs(prev.signed)) : 0;
    if (!prev) {
      d += `M${x(p.from).toFixed(1)},${yv(v).toFixed(1)}`;
      area += `M${x(p.from).toFixed(1)},${base.toFixed(1)}L${x(p.from).toFixed(1)},${yv(v).toFixed(1)}`;
    } else if (touching) {
      d += `V${yv(v).toFixed(1)}`;
      area += `L${x(p.from).toFixed(1)},${yv(pv).toFixed(1)}L${x(p.from).toFixed(1)},${yv(v).toFixed(1)}`;
    } else {
      dashes.push(`M${x(prev.to).toFixed(1)},${yv(pv).toFixed(1)}L${x(p.from).toFixed(1)},${yv(v).toFixed(1)}`);
      d += `M${x(p.from).toFixed(1)},${yv(v).toFixed(1)}`;
      area += `L${x(prev.to).toFixed(1)},${yv(pv).toFixed(1)}L${x(prev.to).toFixed(1)},${base.toFixed(1)}Z M${x(p.from).toFixed(1)},${base.toFixed(1)}L${x(p.from).toFixed(1)},${yv(v).toFixed(1)}`;
    }
    d += `H${x(p.to).toFixed(1)}`;
    area += `L${x(p.to).toFixed(1)},${yv(v).toFixed(1)}`;
  });
  const last = stats.profile[stats.profile.length - 1];
  if (last) area += `L${x(last.to).toFixed(1)},${base.toFixed(1)}Z`;
  cv.parts.push(`<path d="${area}" fill="${cv.c.majorFill}" fill-opacity="0.45"/>`);
  for (const dash of dashes) cv.parts.push(`<path d="${dash}" fill="none" stroke="${cv.c.link}" stroke-width="1.2" stroke-dasharray="1.5 2.8"/>`);
  cv.parts.push(`<path d="${d}" fill="none" stroke="${cv.c.majorStroke}" stroke-width="1.8" stroke-linejoin="round"/>`);
  for (const p of passing) {
    cv.parts.push(`<circle cx="${x(p.pos).toFixed(1)}" cy="${yv(p.v).toFixed(1)}" r="3.4" fill="${cv.c.surface}" stroke="${cv.c.text}" stroke-width="1.3"/>`);
  }

  // bar axis
  const axisY = top + plotH + 12;
  const step = [1, 2, 5, 10, 20, 50, 100, 200].find((s) => (s * (right - left)) / (endBar - 1) >= 40) ?? 500;
  cv.line(left, axisY, right, axisY, cv.c.axis, 1.1);
  for (let b = 1; b < endBar; b++) {
    if (b !== 1 && b % step !== 0) continue;
    cv.line(x(b), axisY, x(b), axisY + 4, cv.c.axis, 1.1);
    cv.text(x(b), axisY + 17, String(b), { size: 12, color: cv.c.muted, anchor: 'middle' });
  }
  cv.text(left - 8, axisY + 17, L.bars, { size: 12, color: cv.c.muted, anchor: 'end' });
  const items = passing.length ? [{ label: L.passing, draw: (lx: number, ly: number) => cv.parts.push(`<circle cx="${lx + 11}" cy="${ly}" r="3.4" fill="${cv.c.surface}" stroke="${cv.c.text}" stroke-width="1.3"/>`) }] : [];
  const ly = axisY + 50;
  if (items.length) legend(cv, ly, items);
  return cv.finish(items.length ? ly + 26 : axisY + 36, L.profTitle);
}

function rowOfSigned(key: Key, stats: Stats, signed: boolean): number {
  const d = (key.mode === 'major' ? key.fifths : key.fifths - 3) - stats.centerRow;
  return signed ? d : Math.abs(d);
}

// ---- 4. by section -----------------------------------------------------------------------------------------------------------
export function chartSections(stats: Stats, piece: Piece): StatChart {
  const lang = piece.style.language as Lang;
  const L = TEXT[lang];
  const cv = new Canvas(piece, 760);
  header(cv, L.secTitle);
  const secs = stats.sections;
  if (secs.length === 0) {
    cv.text(24, 90, L.noSections, { color: cv.c.muted });
    return cv.finish(130, L.secTitle);
  }
  const labelW = Math.max(60, ...secs.map((s) => cv.tw(s.name, 12.5))) + 12;
  const left = 24 + labelW;
  const right = 760 - 100;
  const top = 74;
  const rowH = 36;
  secs.forEach((s, i) => {
    const y = top + i * rowH + rowH / 2;
    cv.text(left - 8, y, s.name, { anchor: 'end' });
    let x = left;
    s.byDistance.forEach((v, d) => {
      if (v <= 0 || s.bars <= 0) return;
      const w = ((right - left) * v) / s.bars;
      cv.rect(x, y - 11, w, 22, classColor(piece, d, stats.classes), cv.c.background, 1);
      if (w >= 34) {
        const fill = d >= 2 ? '#ffffff' : cv.c.text;
        cv.text(x + w / 2, y, formatPercent(v / s.bars, lang).replace(' %', '%'), { size: 11, color: fill, anchor: 'middle' });
      }
      x += w;
    });
    cv.text(right + 10, y, `${formatNumber(s.bars, lang, 1)} ${L.bars}`, { size: 11.5, color: cv.c.muted });
  });
  const ly = top + secs.length * rowH + 22;
  legend(
    cv,
    ly,
    Array.from({ length: stats.classes }, (_, d) => ({
      label: `${d === stats.classes - 1 ? `${d}+` : d} ${unitPlural(stats.measure, lang)}`,
      draw: (lx: number, lyy: number) => cv.rect(lx, lyy - 6, 22, 12, classColor(piece, d, stats.classes), cv.c.axis, 0.8, ' rx="3"'),
    })),
  );
  return cv.finish(ly + 26, L.secTitle);
}

