import { displayTitle, lastBarOf } from '../domain/piece';
import { rowLabel, rowOf, tonicName } from '../domain/keys';
import type { FontFamilyId, Piece, Segment } from '../domain/types';
import { CHART_LABELS } from './labels';

export interface Chart {
  svg: string;
  width: number;
  height: number;
}

/*
 * Geometry is in SVG user units. The proportions come from the original matplotlib script
 * (900 x 565 for 120 bars), so the default output looks the same as before.
 */
const TOP = 96; // top of the plot area
const FIRST_ROW_Y = 135;
const LABEL_X_GAP = 12; // row labels end this far left of the plot
const FIFTHS_COL_GAP = 38; // fifths column sits this far right of the last bar
const RIGHT_MARGIN = 70;
const MIN_WIDTH = 560;

/** Font sizes in px (matplotlib pt at 100 dpi). */
const FS = { title: 20.8, label: 13.2, small: 12.5, section: 14.6 };
/** Line widths and dash patterns, ditto. */
const LW = { bar: 1.25, dominant: 1.5, grid: 0.7, divider: 1.1, link: 1.25, axis: 1.1 };
const DASH = { dominant: '3 2.4', grid: '1.4 2.1', dotted: '1.5 2.8' };

const FONTS: Record<FontFamilyId, string> = {
  sans: "'Helvetica Neue', Helvetica, Arial, 'Segoe UI', system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', Times, serif",
  mono: "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace",
};

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (v: number) => String(Math.round(v * 100) / 100);

function textWidth(s: string, px: number, family: FontFamilyId): number {
  return s.length * px * (family === 'mono' ? 0.62 : family === 'serif' ? 0.5 : 0.52);
}

function autoTickStep(barWidth: number): number {
  return [1, 2, 5, 10, 20, 50, 100, 200].find((s) => s * barWidth >= 55) ?? 500;
}

interface Row {
  row: number;
  y: number;
}

export function renderChart(piece: Piece): Chart {
  const st = piece.style;
  const c = st.colors;
  const lang = CHART_LABELS[st.language];
  const fam = st.fontFamily;
  const fs = (px: number) => px * st.fontScale;
  const lastBar = lastBarOf(piece);
  const centerRow = rowOf(piece.meta.center);

  // ---- rows -------------------------------------------------------------------------------
  const used = [
    centerRow,
    ...piece.segments.map((s) => rowOf(s.key)),
    ...piece.passing.map((p) => rowOf(p.key)),
    ...piece.annotations.map((a) => rowOf(a.key)),
  ];
  let top = Math.max(Math.max(...used), centerRow + 2);
  let bottom = Math.min(Math.min(...used), centerRow - 2);
  top += st.extraRows;
  bottom -= st.extraRows;
  if (st.rowMax !== null) top = st.rowMax;
  if (st.rowMin !== null) bottom = st.rowMin;
  if (top < bottom) [top, bottom] = [bottom, top];
  const rows: Row[] = [];
  for (let r = top; r >= bottom; r--) rows.push({ row: r, y: FIRST_ROW_Y + (top - r) * st.rowHeight });
  const yOf = (row: number) => FIRST_ROW_Y + (top - row) * st.rowHeight;

  // ---- horizontal geometry -------------------------------------------------------------------
  const labelWidth = st.show.rowLabels
    ? Math.max(...rows.map((r) => textWidth(rowLabel(r.row, st.noteNames), fs(FS.label), fam)))
    : 0;
  const left = Math.max(110, Math.ceil(labelWidth) + LABEL_X_GAP + 28);
  const ppb = st.barWidth;
  const xOf = (bar: number) => left + (bar - 1) * ppb;
  const plotRight = xOf(lastBar + 1);
  const title = displayTitle(piece);
  const subtitle = piece.meta.subtitle.trim()
    ? piece.meta.subtitle
    : lang.subtitle(tonicName(centerRow, st.noteNames), lowerFirst(tonicName(centerRow + 3, st.noteNames)));
  const headWidth = 40 + Math.max(
    textWidth(title, fs(FS.title), fam),
    st.show.subtitle ? textWidth(subtitle, fs(FS.label), fam) : 0,
  ) + 40;
  const width = Math.ceil(Math.max(plotRight + RIGHT_MARGIN, headWidth, MIN_WIDTH));
  const fifthsX = plotRight + FIFTHS_COL_GAP;

  // ---- vertical geometry ---------------------------------------------------------------------
  const bottomY = yOf(bottom) + 26;
  const axisY = bottomY - 10;

  const parts: string[] = [];
  const text = (x: number, y: number, s: string, o: { size: number; color?: string; anchor?: string; weight?: number }) =>
    parts.push(
      `<text x="${n(x)}" y="${n(y)}" dy="0.35em" font-size="${n(fs(o.size))}" fill="${o.color ?? c.text}"` +
        (o.anchor && o.anchor !== 'start' ? ` text-anchor="${o.anchor}"` : '') +
        (o.weight ? ` font-weight="${o.weight}"` : '') +
        `>${esc(s)}</text>`,
    );
  const line = (x1: number, y1: number, x2: number, y2: number, color: string, w: number, extra = '') =>
    parts.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${color}" stroke-width="${w}"${extra}/>`);

  // ---- background layers ---------------------------------------------------------------------
  const sections = [...piece.sections].sort((a, b) => a.from - b.from);
  const bandTop = TOP;
  if (st.show.sectionBands) {
    sections.forEach((s, i) => {
      if (!s.shade) return;
      const end = sections[i + 1]?.from ?? lastBar + 1;
      parts.push(
        `<rect x="${n(xOf(s.from))}" y="${bandTop}" width="${n(xOf(end) - xOf(s.from))}" height="${n(bottomY - bandTop)}" fill="${c.sectionBand}" opacity="0.7"/>`,
      );
    });
  }
  for (const h of piece.highlights) {
    const x = xOf(h.from);
    const w = xOf(h.to + 1) - x;
    parts.push(`<rect x="${n(x)}" y="${bandTop}" width="${n(w)}" height="${n(bottomY - bandTop)}" fill="${h.color}" opacity="0.22"/>`);
    if (h.label.trim()) text(x + w / 2, bandTop + 10, h.label, { size: FS.small, color: c.muted, anchor: 'middle' });
  }
  if (st.show.centerBand) {
    parts.push(
      `<rect x="${n(left)}" y="${n(yOf(centerRow) - st.rowHeight / 2)}" width="${n(plotRight - left)}" height="${st.rowHeight}" fill="${c.centerBand}" opacity="0.8"/>`,
    );
  }
  if (st.show.grid) {
    for (const r of rows) line(left, r.y, plotRight, r.y, c.grid, LW.grid, ` stroke-dasharray="${DASH.grid}"`);
  }

  // ---- sections: dividers and names ------------------------------------------------------------
  sections.forEach((s, i) => {
    const end = sections[i + 1]?.from ?? lastBar + 1;
    if (s.from > 1) line(xOf(s.from), bandTop, xOf(s.from), bottomY, c.grid, LW.divider);
    if (st.show.sectionLabels && s.name.trim()) {
      text((xOf(s.from) + xOf(end)) / 2, bandTop - 12, s.name, { size: FS.section, anchor: 'middle', weight: 500 });
    }
  });

  // ---- row labels, fifths column ----------------------------------------------------------------
  for (const r of rows) {
    const isCenter = r.row === centerRow;
    const color = isCenter ? c.text : c.muted;
    if (st.show.rowLabels) {
      text(left - LABEL_X_GAP, r.y, rowLabel(r.row, st.noteNames), { size: FS.label, color, anchor: 'end', weight: isCenter ? 500 : 0 });
    }
    if (st.show.fifthsColumn) {
      text(fifthsX, r.y, String(Math.abs(r.row - centerRow)), { size: FS.label, color, anchor: 'middle', weight: isCenter ? 500 : 0 });
    }
  }
  if (st.show.fifthsColumn) text(fifthsX, bandTop + 2, lang.fifths, { size: FS.small, color: c.muted, anchor: 'middle' });

  // ---- bar axis -------------------------------------------------------------------------------------
  if (st.show.axis) {
    const step = st.tickStep > 0 ? st.tickStep : autoTickStep(ppb);
    line(left, axisY, plotRight, axisY, c.axis, LW.axis);
    const ticks = new Set<number>([1]);
    for (let b = step; b <= lastBar; b += step) ticks.add(b);
    for (const b of ticks) {
      line(xOf(b), axisY, xOf(b), axisY + 4, c.axis, LW.axis);
      text(xOf(b), bottomY + 2, String(b), { size: FS.small, color: c.muted, anchor: 'middle' });
    }
    text(left - LABEL_X_GAP, bottomY + 2, lang.bar, { size: FS.small, color: c.muted, anchor: 'end' });
  }

  // ---- connectors between consecutive segments ----------------------------------------------------
  const segs = [...piece.segments].sort((a, b) => a.from - b.from || a.to - b.to);
  const touching = (a: Segment, b: Segment) => Math.abs(a.to - b.from) < 1e-9;
  if (st.show.connectors) {
    segs.slice(1).forEach((next, i) => {
      const prev = segs[i];
      if (!touching(prev, next) || rowOf(prev.key) === rowOf(next.key)) return;
      line(xOf(next.from), yOf(rowOf(prev.key)), xOf(next.from), yOf(rowOf(next.key)), c.link, LW.link,
        ' stroke-opacity="0.6" stroke-linecap="round"');
    });
  }

  // ---- passing chords: dotted path joining the segments around them ----------------------------------
  const passing = [...piece.passing].sort((a, b) => a.bar - b.bar);
  const groups: typeof passing[] = [];
  for (const p of passing) {
    const g = groups[groups.length - 1];
    if (g && p.bar - g[g.length - 1].bar <= 1) g.push(p);
    else groups.push([p]);
  }
  const dots: string[] = [];
  for (const g of groups) {
    const firstBar = g[0].bar;
    const lastBarOfGroup = g[g.length - 1].bar;
    const before = segs.filter((s) => s.to <= firstBar + 1e-9).sort((a, b) => b.to - a.to)[0];
    const after = segs.filter((s) => s.from >= lastBarOfGroup + 1 - 1e-9).sort((a, b) => a.from - b.from)[0];
    const pts: [number, number][] = g.map((p) => [xOf(p.bar) + ppb / 2, yOf(rowOf(p.key))]);
    if (before) pts.unshift([xOf(before.to), yOf(rowOf(before.key))]);
    if (after) pts.push([xOf(after.from), yOf(rowOf(after.key))]);
    if (st.show.connectors && pts.length > 1) {
      parts.push(
        `<polyline points="${pts.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" fill="none" stroke="${c.link}" stroke-width="${LW.link}" stroke-opacity="0.8" stroke-dasharray="${DASH.dotted}"/>`,
      );
    }
    for (const p of g) {
      dots.push(
        `<circle cx="${n(xOf(p.bar) + ppb / 2)}" cy="${n(yOf(rowOf(p.key)))}" r="3.6" fill="${c.surface}" stroke="${c.text}" stroke-width="${LW.dominant}"/>`,
      );
    }
  }

  // ---- bars ------------------------------------------------------------------------------------------------
  const bh = st.barHeight;
  for (const s of segs) {
    const x = xOf(s.from);
    const w = (s.to - s.from) * ppb;
    if (w <= 0) continue;
    const y = yOf(rowOf(s.key)) - bh / 2;
    const stroke = s.key.mode === 'major' ? c.majorStroke : c.minorStroke;
    const fill = s.key.mode === 'major' ? c.majorFill : c.minorFill;
    if (s.kind === 'dominant') {
      const r = Math.min(bh / 2, w / 2);
      parts.push(
        `<rect x="${n(x + 0.4)}" y="${n(y + 0.4)}" width="${n(Math.max(0, w - 0.8))}" height="${n(bh - 0.8)}" rx="${n(Math.max(0, r - 0.4))}" fill="${c.surface}" stroke="${stroke}" stroke-width="${LW.dominant}" stroke-dasharray="${DASH.dominant}"/>`,
      );
    } else {
      const r = Math.min(bh / 2, w / 2);
      parts.push(
        `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(bh)}" rx="${n(r)}" fill="${fill}" stroke="${stroke}" stroke-width="${LW.bar}"/>`,
      );
    }
  }
  parts.push(...dots);

  // ---- annotations ---------------------------------------------------------------------------------------------
  for (const a of piece.annotations) {
    if (!a.text.trim()) continue;
    const right = a.align === 'right';
    text(xOf(a.bar) + (right ? -8 : 8), yOf(rowOf(a.key)), a.text, { size: FS.small, color: c.muted, anchor: right ? 'end' : 'start' });
  }

  // ---- legend ----------------------------------------------------------------------------------------------------
  let height = bottomY + 80;
  if (st.show.legend) {
    const hasMajor = piece.segments.some((s) => s.key.mode === 'major');
    const hasMinor = piece.segments.some((s) => s.key.mode === 'minor');
    const hasDominant = piece.segments.some((s) => s.kind === 'dominant');
    const none = piece.segments.length === 0;
    type Item = { label: string; draw: (x: number, y: number) => string; w: number };
    const swatch = (fill: string, stroke: string, dashed: boolean) => (x: number, y: number) =>
      `<rect x="${n(x)}" y="${n(y - 6)}" width="22" height="12" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1.4"${dashed ? ` stroke-dasharray="${DASH.dominant}"` : ''}/>`;
    const items: Item[] = [];
    if (hasMajor || none) items.push({ label: lang.major, w: 22, draw: swatch(c.majorFill, c.majorStroke, false) });
    if (hasMinor || none) items.push({ label: lang.minor, w: 22, draw: swatch(c.minorFill, c.minorStroke, false) });
    if (hasDominant || none) items.push({ label: lang.dominant, w: 22, draw: swatch(c.surface, c.majorStroke, true) });
    if (passing.length > 0 || none) {
      items.push({
        label: lang.passing,
        w: 9,
        draw: (x, y) => `<circle cx="${n(x + 4.5)}" cy="${n(y)}" r="3.6" fill="${c.surface}" stroke="${c.text}" stroke-width="${LW.dominant}"/>`,
      });
    }
    let x = left;
    let y = height - 34;
    const maxX = width - 30;
    items.forEach((it, i) => {
      const size = fs(FS.small);
      const full = it.w + 8 + textWidth(it.label, size, fam);
      if (i > 0 && x + full > maxX) {
        x = left;
        y += 24;
        height += 24;
      }
      parts.push(it.draw(x, y));
      text(x + it.w + 8, y, it.label, { size: FS.small });
      x += full + 30;
    });
  }

  // ---- header (drawn last in code, but order does not matter visually) -----------------------------------------------
  const head: string[] = [];
  const headText = (x: number, y: number, s: string, size: number, color: string, weight?: number) =>
    head.push(
      `<text x="${x}" y="${y}" dy="0.35em" font-size="${n(fs(size))}" fill="${color}"${weight ? ` font-weight="${weight}"` : ''}>${esc(s)}</text>`,
    );
  if (title) headText(40, 34, title, FS.title, c.text, 500);
  if (st.show.subtitle) headText(40, 56, subtitle, FS.label, c.muted);

  const bg = st.transparentBackground ? '' : `<rect width="${width}" height="${n(height)}" fill="${c.background}"/>`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${n(height)}" viewBox="0 0 ${width} ${n(height)}" font-family="${esc(FONTS[fam])}">` +
    bg + head.join('') + parts.join('') + '</svg>';
  return { svg, width, height };
}
