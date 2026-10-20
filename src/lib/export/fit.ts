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
