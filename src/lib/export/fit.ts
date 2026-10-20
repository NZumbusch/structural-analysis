import type { Piece } from '../domain/types';
import { FS, renderChart, type ViewRange } from '../render/chart';

/** How tall (in pt) the row labels print when the chart is `widthCm` wide. */
export function labelPoints(piece: Piece, widthCm: number, view?: ViewRange | null): number {
  const { width } = renderChart(piece, { view });
  return ((FS.label * piece.style.fontScale) / width) * (widthCm / 2.54) * 72;
}

/**
 * The font scale that makes the row labels print at `targetPt` when the chart is `widthCm` wide.
 * The chart's own width depends slightly on the font size (long titles), so this iterates.
 */
export function fitFontScale(piece: Piece, widthCm: number, targetPt: number, view?: ViewRange | null): number {
  let scale = piece.style.fontScale;
  for (let i = 0; i < 8; i++) {
    const probe: Piece = { ...piece, style: { ...piece.style, fontScale: scale } };
    const { width } = renderChart(probe, { view });
    const next = (targetPt * width * 2.54) / (72 * widthCm * FS.label);
    if (Math.abs(next - scale) < 0.002) {
      scale = next;
      break;
    }
    scale = next;
  }
  return Math.min(4, Math.max(0.4, Math.round(scale * 100) / 100));
}

/**
 * The row spacing that makes the chart `targetCm` tall when it is printed `widthCm` wide.
 * Height grows in a straight line with the row spacing, so two measurements are enough.
 */
export function fitRowHeight(piece: Piece, widthCm: number, targetCm: number, view?: ViewRange | null): number {
  const at = (rowHeight: number) => {
    const probe: Piece = { ...piece, style: { ...piece.style, rowHeight } };
    const { width, height } = renderChart(probe, { view });
    return { width, height };
  };
  const a = at(40);
  const b = at(50);
  const slope = (b.height - a.height) / 10;
  if (!(slope > 0)) return piece.style.rowHeight;
  const targetUnits = (targetCm * a.width) / widthCm;
  const rowHeight = 40 + (targetUnits - a.height) / slope;
  return Math.min(90, Math.max(14, Math.round(rowHeight)));
}
