import { folded } from '../domain/fold';
import { displayTitle } from '../domain/piece';
import {
  endPos, expandPlayOrder, hasRepeats, lastBarOf, meterMap, sectionSpans, sortedEvents, startPos,
} from '../domain/structure';
import { rowLabel, rowOf, spellingRow, tonicName } from '../domain/keys';
import { barRange } from '../domain/positions';
import { TONICIZATIONS, type FontFamilyId, type Piece, type Segment, type Tonicization } from '../domain/types';
import { CHART_LABELS } from './labels';
import { accidentalPath, accidentalWidth } from './glyphs';
import { FONT_STACK } from './fonts';
import { HATCH_FILL, hatchDef } from './hatch';

export interface ViewRange {
  from: number;
  /** Exclusive. */
  to: number;
}

export interface Interactive {
  /** Width of the grab handles in chart units (so they stay comfortable at any preview scale). */
  handle: number;
  selected: string | null;
}

export interface RenderOptions {
  /** Zoom into this range instead of drawing the whole piece. */
  view?: ViewRange | null;
  /** Adds hit areas, drag handles and a selection halo. Never used for exports. */
  interactive?: Interactive;
  /** Physical width in cm for SVG/PDF output; the viewBox keeps the proportions. */
  widthCm?: number;
}

/** What a pointer position in the preview means; lets the editor turn drags into data changes. */
export interface Geometry {
  left: number;
  plotRight: number;
  from: number;
  to: number;
  ppb: number;
  topRow: number;
  bottomRow: number;
  firstRowY: number;
  rowHeight: number;
}

export interface Chart {
  svg: string;
  width: number;
  height: number;
  geometry: Geometry;
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
const SELECT = '#0a84ff';

/** Font sizes in px (matplotlib pt at 100 dpi). */
export const FS = { title: 20.8, label: 13.2, small: 12.5, section: 14.6, barLabel: 11 };
/** Line widths and dash patterns, ditto. */
const LW = { bar: 1.25, dominant: 1.5, grid: 0.7, divider: 1.1, link: 1.25, axis: 1.1 };
const DASH = { dominant: '3 2.4', neapolitan: '1.2 2.2', tonicization: '6 2.6', grid: '1.4 2.1', dotted: '1.5 2.8', marker: '4 3' };

export const FONTS: Record<FontFamilyId, string> = FONT_STACK;

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (v: number) => String(Math.round(v * 100) / 100);

interface Sink {
  push: (...items: string[]) => unknown;
}

export function textWidth(s: string, px: number, family: FontFamilyId): number {
  return s.length * px * (family === 'mono' ? 0.62 : family === 'serif' ? 0.5 : 0.52);
}

function autoTickStep(ppb: number): number {
  return [1, 2, 5, 10, 20, 50, 100, 200].find((s) => s * ppb >= 55) ?? 500;
}

const overlaps = (a: number, b: number, from: number, to: number) => b > from && a < to;

export function renderChart(source: Piece, options: RenderOptions = {}): Chart {
  // Repeats laid out in play order (a derived copy; the editor keeps working on the notated piece).
  const expanded = source.style.repeatDisplay === 'expanded' && hasRepeats(source) ? expandPlayOrder(source) : null;
  const piece = folded(expanded ? expanded.piece : source);
  const st = piece.style;
  const c = st.colors;
  const lang = CHART_LABELS[st.language];
  const fam = st.fontFamily;
  const fs = (px: number) => px * st.fontScale;
  const centerRow = rowOf(piece.meta.center);
  const meters = meterMap(piece);
  const beatsAt = (pos: number) => meters.at(pos).beats;
  const ia = expanded ? undefined : options.interactive;
  const start = startPos(piece);
  const EPS = 1e-9;

  // ---- range shown ----------------------------------------------------------------------------
  const zoomed = !!options.view;
  const from = zoomed ? Math.max(start, options.view!.from) : start;
  const to = zoomed ? Math.max(from + 1 / beatsAt(from), options.view!.to) : endPos(piece);
  // barWidth 0 = automatic: about 720 units of plot for the whole piece, never cramped or huge
  const ppb = zoomed ? st.detailWidth / (to - from) : st.barWidth > 0 ? st.barWidth : Math.min(40, Math.max(6, 720 / (to - from)));
  const inView = (pos: number) => pos >= from - 1e-9 && pos < to - 1e-9;

  const annotations = st.show.annotations ? piece.annotations.filter((a) => !a.hidden && a.text.trim()) : [];
  const visibleSegments = piece.segments.filter((s) => overlaps(s.from, s.to, from, to));
  const visiblePassing = piece.passing.filter((p) => inView(p.pos));
  const visibleAnnotations = annotations.filter((a) => inView(a.pos));

  // ---- rows -------------------------------------------------------------------------------
  const used = [
    centerRow,
    ...(zoomed ? visibleSegments : piece.segments).map((s) => rowOf(s.key)),
    ...(zoomed ? visiblePassing : piece.passing).map((p) => rowOf(p.key)),
    ...(zoomed ? visibleAnnotations : annotations).map((a) => rowOf(a.key)),
  ];
  let top = Math.max(Math.max(...used), centerRow + 2);
  let bottom = Math.min(Math.min(...used), centerRow - 2);
  top += st.extraRows;
  bottom -= st.extraRows;
  if (st.rowMax !== null) top = st.rowMax;
  if (st.rowMin !== null) bottom = st.rowMin;
  if (top < bottom) [top, bottom] = [bottom, top];
  const spans = sectionSpans(piece);
  const hasSubs = st.show.subsections && spans.some((sp) => sp.subs.length > 0);
  const headExtra = hasSubs ? 20 : 0; // room for the second row of part names
  const firstRowY = FIRST_ROW_Y + headExtra;
  const rows: { row: number; y: number }[] = [];
  for (let r = top; r >= bottom; r--) rows.push({ row: r, y: firstRowY + (top - r) * st.rowHeight });
  const yOf = (row: number) => firstRowY + (top - row) * st.rowHeight;
  const rowText = (r: number) => st.rowNames[String(r)]?.trim() || rowLabel(r, st.noteNames, st.enharmonic);

  // ---- horizontal geometry -------------------------------------------------------------------
  const labelWidth = st.show.rowLabels
    ? Math.max(...rows.map((r) => textWidth(rowText(r.row), fs(FS.label), fam)))
    : 0;
  const left = Math.max(110, Math.ceil(labelWidth) + LABEL_X_GAP + 28);
  const xOf = (pos: number) => left + (pos - from) * ppb;
  const plotRight = xOf(to);
  const title = displayTitle(piece);
  const [firstBarShown, lastBarShown] = barRange(from, to);
  let subtitle = piece.meta.subtitle.trim()
    ? piece.meta.subtitle
    : lang.subtitle(
        tonicName(spellingRow(centerRow, st.enharmonic), st.noteNames),
        lowerFirst(tonicName(spellingRow(centerRow, st.enharmonic) + 3, st.noteNames)),
      );
  if (zoomed && st.show.viewRange) {
    subtitle += ` · ${lang.bar} ${firstBarShown}${lastBarShown > firstBarShown ? `–${lastBarShown}` : ''}`;
  }
  const headWidth =
    40 +
    Math.max(
      textWidth(title, fs(FS.title), fam),
      st.show.subtitle ? textWidth(subtitle, fs(FS.label), fam) : 0,
    ) +
    40;
  const width = Math.ceil(Math.max(plotRight + RIGHT_MARGIN, headWidth, MIN_WIDTH));
  const fifthsX = plotRight + FIFTHS_COL_GAP;

  // ---- vertical geometry ---------------------------------------------------------------------
  const bottomY = yOf(bottom) + 26;
  const axisY = bottomY - 10;
  const bandTop = TOP + headExtra;

  const parts: string[] = [];
  /** Plot content; clipped to the plot area when zoomed so partly visible bars end cleanly at the edge. */
  const plot: Sink = {
    push: (...xs: string[]) => parts.push(...xs.map((x) => (zoomed ? `<g clip-path="url(#plot-clip)">${x}</g>` : x))),
  };
  const text = (
    out: Sink,
    x: number,
    y: number,
    s: string,
    o: { size: number; color?: string; anchor?: string; weight?: number; attrs?: string },
  ) =>
    out.push(
      `<text x="${n(x)}" y="${n(y)}" dy="0.35em" font-size="${n(fs(o.size))}" fill="${o.color ?? c.text}"` +
        (o.anchor && o.anchor !== 'start' ? ` text-anchor="${o.anchor}"` : '') +
        (o.weight ? ` font-weight="${o.weight}"` : '') +
        (o.attrs ?? '') +
        `>${esc(s)}</text>`,
    );
  const line = (out: Sink, x1: number, y1: number, x2: number, y2: number, color: string, w: number, extra = '') =>
    out.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${color}" stroke-width="${w}"${extra}/>`);

  // ---- background layers ---------------------------------------------------------------------
  if (st.show.sectionBands) {
    for (const sp of spans) {
      if (!sp.shade || !overlaps(sp.from, sp.to, from, to)) continue;
      const x0 = xOf(Math.max(sp.from, from));
      const x1 = xOf(Math.min(sp.to, to));
      plot.push(`<rect x="${n(x0)}" y="${bandTop}" width="${n(x1 - x0)}" height="${n(bottomY - bandTop)}" fill="${c.sectionBand}" opacity="0.7"/>`);
    }
  }
  for (const h of piece.highlights) {
    if (!overlaps(h.from, h.to + 1, from, to)) continue;
    const x0 = xOf(Math.max(h.from, from));
    const x1 = xOf(Math.min(h.to + 1, to));
    plot.push(`<rect x="${n(x0)}" y="${bandTop}" width="${n(x1 - x0)}" height="${n(bottomY - bandTop)}" fill="${h.color}" opacity="0.22"/>`);
    if (h.label.trim()) text(plot, (x0 + x1) / 2, bandTop + 10, h.label, { size: FS.small, color: c.muted, anchor: 'middle' });
  }
  if (st.show.centerBand) {
    parts.push(
      `<rect x="${n(left)}" y="${n(yOf(centerRow) - st.rowHeight / 2)}" width="${n(plotRight - left)}" height="${st.rowHeight}" fill="${c.centerBand}" opacity="0.8"/>`,
    );
  }
  if (st.show.grid) {
    for (const r of rows) line(parts, left, r.y, plotRight, r.y, c.grid, LW.grid, ` stroke-dasharray="${DASH.grid}"`);
  }

  // bar and beat lines when zoomed in far enough
  const showBarLines = st.barLines === 'on' || (st.barLines === 'auto' && ppb >= 18);
  if (showBarLines) {
    for (let b = Math.ceil(from + EPS); b < to; b++) {
      line(parts, xOf(b), bandTop, xOf(b), bottomY - 10, c.grid, 0.6, ' stroke-opacity="0.8"');
    }
    for (let b = Math.floor(from); b < to; b++) {
      const nb = beatsAt(b);
      if (ppb / nb < 22) continue;
      for (let k = 1; k < nb; k++) {
        const pos = b + k / nb;
        if (pos > from && pos < to) line(parts, xOf(pos), bandTop + 14, xOf(pos), bottomY - 10, c.grid, 0.5, ' stroke-opacity="0.55" stroke-dasharray="1 3"');
      }
    }
  }

  // ---- parts of the form: dividers, names, and the second row of sub-parts ---------------------------
  for (const sp of spans) {
    if (!overlaps(sp.from, sp.to, from, to)) continue;
    if (sp.id && sp.from > start + EPS && sp.from > from && sp.from < to) line(parts, xOf(sp.from), bandTop - headExtra, xOf(sp.from), bottomY, c.grid, LW.divider);
    if (st.show.sectionLabels && sp.name.trim()) {
      const x0 = xOf(Math.max(sp.from, from));
      const x1 = xOf(Math.min(sp.to, to));
      text(parts, (x0 + x1) / 2, TOP - 12, sp.name, { size: FS.section, anchor: 'middle', weight: 500 });
    }
    if (!hasSubs) continue;
    for (const sub of sp.subs) {
      if (!overlaps(sub.from, sub.to, from, to)) continue;
      if (sub.from > sp.from + EPS && sub.from > from && sub.from < to) line(parts, xOf(sub.from), bandTop - 15, xOf(sub.from), bandTop, c.grid, LW.divider);
      if (sub.name.trim()) {
        const x0 = xOf(Math.max(sub.from, from));
        const x1 = xOf(Math.min(sub.to, to));
        text(parts, (x0 + x1) / 2, bandTop - 8, sub.name, { size: FS.small, color: c.muted, anchor: 'middle' });
      }
    }
  }

  // ---- row labels, fifths column ----------------------------------------------------------------
  for (const r of rows) {
    const isCenter = r.row === centerRow;
    const color = isCenter ? c.text : c.muted;
    if (st.show.rowLabels) {
      text(parts, left - LABEL_X_GAP, r.y, rowText(r.row), { size: FS.label, color, anchor: 'end', weight: isCenter ? 500 : 0 });
    }
    if (st.show.fifthsColumn) {
      text(parts, fifthsX, r.y, String(Math.abs(r.row - centerRow)), { size: FS.label, color, anchor: 'middle', weight: isCenter ? 500 : 0 });
    }
  }
  if (st.show.fifthsColumn) text(parts, fifthsX, bandTop + 2, lang.fifths, { size: FS.small, color: c.muted, anchor: 'middle' });

  // ---- bar axis -------------------------------------------------------------------------------------
  const labelOf = expanded ? expanded.labelOf : (b: number) => String(b);
  const firstTickBar = Math.ceil(start - EPS);
  if (st.show.axis) {
    const step = st.tickStep > 0 ? st.tickStep : autoTickStep(ppb);
    line(parts, left, axisY, plotRight, axisY, c.axis, LW.axis);
    for (let b = Math.ceil(from - EPS); b < to; b++) {
      const barNo = expanded ? Number(expanded.labelOf(b)) : b; // ticks follow the notated numbers in play order
      if (!(b === firstTickBar || barNo % step === 0)) {
        if (!(st.tickStep === 0 && zoomed && b === Math.ceil(from - EPS) && step * ppb >= 110)) continue;
      }
      line(parts, xOf(b), axisY, xOf(b), axisY + 4, c.axis, LW.axis);
      text(parts, xOf(b), bottomY + 2, labelOf(b), { size: FS.small, color: c.muted, anchor: 'middle' });
    }
    for (let b = Math.floor(from); b < to; b++) {
      const nb = beatsAt(b);
      const showBeatTicks = st.beatTicks === 'on' || (st.beatTicks === 'auto' && ppb / nb >= 9);
      if (!showBeatTicks) continue;
      for (let k = 1; k < nb; k++) {
        const pos = b + k / nb;
        if (pos > from && pos < to) line(parts, xOf(pos), axisY, xOf(pos), axisY + 2.5, c.axis, 0.8);
      }
    }
    text(parts, left - LABEL_X_GAP, bottomY + 2, lang.bar, { size: FS.small, color: c.muted, anchor: 'end' });
  }

  // ---- structure events: meter, repeats, endings, barlines, markers ---------------------------------------
  const events = sortedEvents(piece);
  // where the music jumps back in a play-order layout
  for (const j of expanded?.jumps ?? []) {
    if (j > from && j < to) line(parts, xOf(j), bandTop, xOf(j), axisY, c.axis, 1, ' stroke-opacity="0.8" stroke-dasharray="1.5 3"');
  }
  const at = (pos: number) => pos >= from - EPS && pos <= to + EPS;
  const markEvents = st.show.markers ? events.filter((e) => ['marker', 'text', 'keysig', 'fermata'].includes(e.kind) && inView(e.pos)) : [];
  const meterEvents = st.show.meterSigns ? events.filter((e) => e.kind === 'meter') : [];
  const laneUsed = markEvents.some((e) => e.kind !== 'marker' || e.label.trim()) || meterEvents.some((e) => at(e.pos));
  const voltas = st.show.repeats ? events.filter((e) => e.kind === 'volta' && overlaps(e.pos, e.to, from, to)) : [];
  const lanesExtra = laneUsed && voltas.length > 0 ? 24 : 0;
  const laneY = bottomY + 16;
  const laneMid = bottomY + 16 + (fs(FS.small) + 6) / 2;

  // Lane items are laid out left to right so signs, texts and markers never sit on top of each other.
  interface LaneItem {
    pos: number;
    width: number;
    center: boolean;
    draw: (x: number) => void;
  }
  const laneItems: LaneItem[] = [];
  const tw = (label: string, size: number, extra = 0) => textWidth(label, fs(size), fam) + extra;
  for (const e of markEvents) {
    if (e.kind === 'marker') {
      if (e.line) line(parts, xOf(e.pos), bandTop, xOf(e.pos), axisY, c.link, 1, ` stroke-opacity="0.75" stroke-dasharray="${DASH.marker}"`);
      if (e.label.trim()) {
        const w = tw(e.label, FS.small, 12);
        laneItems.push({
          pos: e.pos, width: w, center: true,
          draw: (x) => {
            parts.push(`<g><rect x="${n(x)}" y="${n(laneY)}" width="${n(w)}" height="${n(fs(FS.small) + 6)}" rx="3" fill="${c.surface}" stroke="${c.axis}" stroke-width="1"/>`);
            text(parts, x + w / 2, laneMid, e.label, { size: FS.small, anchor: 'middle' });
            parts.push('</g>');
          },
        });
      }
    } else if (e.kind === 'text' && e.label.trim()) {
      laneItems.push({ pos: e.pos, width: tw(e.label, FS.small, 4), center: false, draw: (x) => text(parts, x, laneMid, e.label, { size: FS.small, color: c.muted, attrs: ' font-style="italic"' }) });
    } else if (e.kind === 'keysig') {
      const k = Math.abs(e.fifths);
      const digits = k === 0 ? '' : String(k);
      const size = fs(FS.small);
      laneItems.push({
        pos: e.pos, width: tw(digits, FS.small, 0) + accidentalWidth(size) + 4, center: false,
        draw: (x) => {
          if (digits) text(parts, x, laneMid, digits, { size: FS.small, color: c.muted });
          const ax = x + tw(digits, FS.small, 1);
          parts.push(accidentalPath(k === 0 ? 'natural' : e.fifths > 0 ? 'sharp' : 'flat', ax, laneMid + size * 0.35, size, c.muted));
        },
      });
    } else if (e.kind === 'fermata') {
      laneItems.push({
        pos: e.pos, width: 14, center: true,
        draw: (x) =>
          parts.push(
            `<path d="M${n(x + 1)},${n(laneMid + 3)} C${n(x + 1)},${n(laneMid - 8)} ${n(x + 13)},${n(laneMid - 8)} ${n(x + 13)},${n(laneMid + 3)}" fill="none" stroke="${c.text}" stroke-width="1.3"/>` +
              `<circle cx="${n(x + 7)}" cy="${n(laneMid - 0.5)}" r="1.5" fill="${c.text}"/>`,
          ),
      });
    }
  }
  if (meterEvents.length > 0) {
    const shown = meterEvents.filter((e) => at(e.pos)).map((e) => ({ pos: e.pos, beats: e.beats, unit: e.unit }));
    if (!shown.some((e) => Math.abs(e.pos - start) < EPS) && at(start)) {
      shown.unshift({ pos: start, beats: meters.at(start).beats, unit: meters.at(start).unit });
    }
    for (const e of shown) {
      const label = `${e.beats}/${e.unit}`;
      laneItems.push({ pos: e.pos, width: tw(label, FS.small, 4), center: false, draw: (x) => text(parts, x, laneMid, label, { size: FS.small, weight: 500 }) });
    }
  }
  let laneRight = -Infinity;
  for (const it of laneItems.sort((a, b) => a.pos - b.pos)) {
    const natural = xOf(it.pos) + (it.center ? -it.width / 2 : 2);
    const x = Math.max(natural, laneRight + 6);
    it.draw(x);
    laneRight = x + it.width;
  }

  if (st.show.repeats) {
    for (const e of events) {
      if (!at(e.pos)) continue;
      const x = xOf(e.pos);
      if (e.kind === 'barline') {
        const col = c.text;
        if (e.style === 'final') {
          line(parts, x - 3.5, bandTop - 2, x - 3.5, axisY, col, 1, ' stroke-opacity="0.7"');
          line(parts, x, bandTop - 2, x, axisY, col, 3, ' stroke-opacity="0.7"');
        } else {
          line(parts, x - 2, bandTop - 2, x - 2, axisY, col, 1, ' stroke-opacity="0.7"');
          line(parts, x + 1.5, bandTop - 2, x + 1.5, axisY, col, 1, ' stroke-opacity="0.7"');
        }
      } else if (e.kind === 'repeat-start' || e.kind === 'repeat-end') {
        const dir = e.kind === 'repeat-start' ? 1 : -1;
        line(parts, x, bandTop, x, axisY - 8, c.axis, 1, ' stroke-opacity="0.7" stroke-dasharray="2 3"');
        line(parts, x, axisY - 8, x, axisY + 8, c.text, 2.6);
        line(parts, x + dir * 4, axisY - 8, x + dir * 4, axisY + 8, c.text, 1);
        parts.push(`<circle cx="${n(x + dir * 8)}" cy="${n(axisY - 3.5)}" r="1.4" fill="${c.text}"/><circle cx="${n(x + dir * 8)}" cy="${n(axisY + 3.5)}" r="1.4" fill="${c.text}"/>`);
        if (e.kind === 'repeat-end' && e.times !== 2) text(parts, x, axisY - 16, `${e.times}×`, { size: FS.small, color: c.muted, anchor: 'middle' });
      }
    }
    voltas.forEach((v) => {
      const x0 = xOf(Math.max(v.pos, from));
      const x1 = xOf(Math.min(v.to, to));
      const yb = bottomY + 16 + (laneUsed ? 24 : 0) + 2;
      line(parts, x0, yb, x1, yb, c.text, 1);
      if (v.pos >= from - EPS) line(parts, x0, yb, x0, yb + 8, c.text, 1);
      text(parts, x0 + 5, yb + 9, `${v.numbers.join(', ')}.`, { size: FS.small });
    });
  }

  // ---- connectors between consecutive segments ----------------------------------------------------
  const segs = [...piece.segments].sort((a, b) => a.from - b.from || a.to - b.to);
  const touching = (a: Segment, b: Segment) => Math.abs(a.to - b.from) < 1e-9;
  if (st.show.connectors) {
    segs.slice(1).forEach((next, i) => {
      const prev = segs[i];
      if (!touching(prev, next) || rowOf(prev.key) === rowOf(next.key)) return;
      line(plot, xOf(next.from), yOf(rowOf(prev.key)), xOf(next.from), yOf(rowOf(next.key)), c.link, LW.link,
        ' stroke-opacity="0.6" stroke-linecap="round"');
    });
  }

  // ---- passing chords: dotted path joining the segments around them ----------------------------------
  const passing = [...piece.passing].sort((a, b) => a.pos - b.pos);
  const groups: (typeof passing)[] = [];
  for (const p of passing) {
    const g = groups[groups.length - 1];
    if (g && p.pos - g[g.length - 1].pos <= 1 + 1e-9) g.push(p);
    else groups.push([p]);
  }
  const dots: string[] = [];
  for (const g of groups) {
    const first = g[0].pos;
    const last = g[g.length - 1].pos;
    const before = segs.filter((s) => s.to <= first + 1e-9).sort((a, b) => b.to - a.to)[0];
    const after = segs.filter((s) => s.from >= last - 1e-9).sort((a, b) => a.from - b.from)[0];
    const pts: [number, number][] = g.map((p) => [xOf(p.pos), yOf(rowOf(p.key))]);
    if (before && first - before.to < 2) pts.unshift([xOf(before.to), yOf(rowOf(before.key))]);
    if (after && after.from - last < 2) pts.push([xOf(after.from), yOf(rowOf(after.key))]);
    if (st.show.connectors && pts.length > 1) {
      plot.push(
        `<polyline points="${pts.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" fill="none" stroke="${c.link}" stroke-width="${LW.link}" stroke-opacity="0.8" stroke-dasharray="${DASH.dotted}"/>`,
      );
    }
    for (const p of g) {
      if (!inView(p.pos)) continue;
      const cx = xOf(p.pos);
      const cy = yOf(rowOf(p.key));
      const sel = ia?.selected === p.id;
      const attrs = ia ? ` data-kind="passing" data-id="${p.id}" style="cursor:grab"` : '';
      dots.push(
        `<g${attrs}>` +
          (ia ? `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(Math.max(8, ia.handle * 0.7))}" fill="transparent"/>` : '') +
          (sel ? `<circle cx="${n(cx)}" cy="${n(cy)}" r="7" fill="none" stroke="${SELECT}" stroke-width="1.5"/>` : '') +
          `<circle cx="${n(cx)}" cy="${n(cy)}" r="3.6" fill="${c.surface}" stroke="${c.text}" stroke-width="${LW.dominant}"/></g>`,
      );
    }
  }

  // ---- bars ------------------------------------------------------------------------------------------------
  const minorFill = st.hatch ? HATCH_FILL : c.minorFill;
  const bh = st.barHeight;
  const handles: string[] = [];
  for (const s of segs) {
    if (!overlaps(s.from, s.to, from, to)) continue;
    const x = xOf(s.from);
    const w = (s.to - s.from) * ppb;
    if (w <= 0) continue;
    const cy = yOf(rowOf(s.key));
    const y = cy - bh / 2;
    const stroke = s.key.mode === 'major' ? c.majorStroke : c.minorStroke;
    const fill = s.key.mode === 'major' ? c.majorFill : minorFill;
    const r = Math.min(bh / 2, w / 2);
    const sel = ia?.selected === s.id;
    const attrs = ia ? ` data-kind="segment" data-id="${s.id}" style="cursor:pointer"` : '';
    let shape: string;
    if (s.kind !== 'key') {
      shape = `<rect x="${n(x + 0.4)}" y="${n(y + 0.4)}" width="${n(Math.max(0, w - 0.8))}" height="${n(bh - 0.8)}" rx="${n(Math.max(0, r - 0.4))}" fill="${c.surface}" stroke="${stroke}" stroke-width="${LW.dominant}" stroke-dasharray="${DASH[s.kind]}"/>`;
    } else {
      shape = `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(bh)}" rx="${n(r)}" fill="${fill}" stroke="${stroke}" stroke-width="${LW.bar}"/>`;
    }
    plot.push(
      `<g${attrs}>` +
        (ia ? `<rect x="${n(Math.min(x, x + w / 2 - 6))}" y="${n(y - 3)}" width="${n(Math.max(w, 12))}" height="${n(bh + 6)}" fill="transparent"/>` : '') +
        (sel ? `<rect x="${n(x - 2.5)}" y="${n(y - 2.5)}" width="${n(w + 5)}" height="${n(bh + 5)}" rx="${n(r + 2.5)}" fill="none" stroke="${SELECT}" stroke-width="1.5"/>` : '') +
        shape +
        '</g>',
    );
    // text on the bar: inside when it fits, above otherwise
    if (st.show.barLabels && s.label.trim()) {
      const size = fs(FS.barLabel);
      const fits = textWidth(s.label, size, fam) + 6 <= Math.min(w, (Math.min(s.to, to) - Math.max(s.from, from)) * ppb + 0.1);
      const cx = (xOf(Math.max(s.from, from)) + xOf(Math.min(s.to, to))) / 2;
      plot.push(
        `<text x="${n(cx)}" y="${n(fits ? cy : y - 6)}" dy="0.35em" font-size="${n(size)}" fill="${fits ? stroke : c.muted}" text-anchor="middle" pointer-events="none">${esc(s.label)}</text>`,
      );
    }
    if (ia) {
      const hw = Math.min(ia.handle, Math.max(w / 2, 3));
      const handle = (edge: 'from' | 'to', hx: number) =>
        `<rect x="${n(hx - hw / 2)}" y="${n(y - 3)}" width="${n(hw)}" height="${n(bh + 6)}" fill="transparent" style="cursor:ew-resize" data-kind="segment" data-id="${s.id}" data-handle="${edge}"/>`;
      if (s.from >= from) handles.push(handle('from', x));
      if (s.to <= to) handles.push(handle('to', x + w));
    }
  }
  plot.push(...dots);
  plot.push(...handles);

  // ---- annotations ---------------------------------------------------------------------------------------------
  for (const a of annotations) {
    if (!inView(a.pos)) continue;
    const ax = xOf(a.pos);
    const ay = yOf(rowOf(a.key));
    let right = a.align === 'right';
    const size = fs(FS.small);
    const tw = textWidth(a.text, size, fam);
    // text that would run into the fifths column goes to the other side of its anchor
    if (!right && ax + 8 + a.dx + tw > plotRight + 28) right = true;
    const tx = ax + (right ? -8 : 8) + a.dx;
    const ty = ay + a.dy;
    if (Math.abs(a.dx) > 20 || Math.abs(a.dy) > 10) {
      const edge = right ? tx + 3 : tx - 3;
      parts.push(`<line x1="${n(ax)}" y1="${n(ay)}" x2="${n(edge)}" y2="${n(ty)}" stroke="${c.link}" stroke-width="0.8" stroke-opacity="0.8"/>`);
      parts.push(`<circle cx="${n(ax)}" cy="${n(ay)}" r="1.6" fill="${c.link}"/>`);
    }
    const sel = ia?.selected === a.id;
    const bx = right ? tx - tw : tx;
    if (ia) {
      parts.push(`<g data-kind="annotation" data-id="${a.id}" style="cursor:move">`);
      parts.push(`<rect x="${n(bx - 3)}" y="${n(ty - size / 2 - 3)}" width="${n(tw + 6)}" height="${n(size + 6)}" rx="3" fill="transparent"${sel ? ` stroke="${SELECT}" stroke-width="1.5"` : ''}/>`);
    }
    text(parts, tx, ty, a.text, { size: FS.small, color: c.muted, anchor: right ? 'end' : 'start' });
    if (ia) parts.push('</g>');
  }

  // ---- legend ----------------------------------------------------------------------------------------------------
  let height = bottomY + 80 + lanesExtra;
  if (st.show.legend) {
    const hasMajor = piece.segments.some((s) => s.key.mode === 'major');
    const hasMinor = piece.segments.some((s) => s.key.mode === 'minor');
    const usedKinds = TONICIZATIONS.filter((k) => piece.segments.some((s) => s.kind === k));
    const none = piece.segments.length === 0;
    type Item = { label: string; draw: (x: number, y: number) => string; w: number };
    const swatch = (fill: string, stroke: string, dash?: string) => (x: number, y: number) =>
      `<rect x="${n(x)}" y="${n(y - 6)}" width="22" height="12" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1.4"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
    const items: Item[] = [];
    if (hasMajor || none) items.push({ label: lang.major, w: 22, draw: swatch(c.majorFill, c.majorStroke) });
    if (hasMinor || none) items.push({ label: lang.minor, w: 22, draw: swatch(minorFill, c.minorStroke) });
    for (const k of none ? (['dominant'] as Tonicization[]) : usedKinds) items.push({ label: lang[k], w: 22, draw: swatch(c.surface, c.majorStroke, DASH[k]) });
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
      const full = it.w + 8 + textWidth(it.label, fs(FS.small), fam);
      if (i > 0 && x + full > maxX) {
        x = left;
        y += 24;
        height += 24;
      }
      parts.push(it.draw(x, y));
      text(parts, x + it.w + 8, y, it.label, { size: FS.small });
      x += full + 30;
    });
  }

  // ---- header ------------------------------------------------------------------------------------------------------
  const head: string[] = [];
  if (title) text(head, 40, 34, title, { size: FS.title, weight: 500 });
  if (st.show.subtitle) text(head, 40, 56, subtitle, { size: FS.label, color: c.muted });

  const bg = st.transparentBackground ? '' : `<rect width="${width}" height="${n(height)}" fill="${c.background}"/>`;
  const defs =
    (zoomed ? `<clipPath id="plot-clip"><rect x="${n(left - 1)}" y="${bandTop - 2}" width="${n(plotRight - left + 2)}" height="${n(bottomY - bandTop + 4)}"/></clipPath>` : '') +
    (st.hatch ? hatchDef(c) : '');
  const clip = defs ? `<defs>${defs}</defs>` : '';
  const size = options.widthCm
    ? `width="${n(options.widthCm)}cm" height="${n((options.widthCm * height) / width)}cm"`
    : `width="${width}" height="${n(height)}"`;
  const label = [title, subtitle].filter(Boolean).join(' – ');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" ${size} viewBox="0 0 ${width} ${n(height)}" font-family="${esc(FONTS[fam])}" role="img" aria-label="${esc(label)}">` +
    `<title>${esc(title || lang.fifths)}</title><desc>${esc(piece.meta.altText?.trim() || subtitle)}</desc>` +
    clip +
    bg +
    head.join('') +
    parts.join('') +
    '</svg>';
  return {
    svg,
    width,
    height,
    geometry: { left, plotRight, from, to, ppb, topRow: top, bottomRow: bottom, firstRowY, rowHeight: st.rowHeight },
  };
}
