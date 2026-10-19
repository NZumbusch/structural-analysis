import { fileSlug, normalizePiece } from '../domain/piece';
import { newId } from '../domain/ids';
import type { Piece } from '../domain/types';
import { renderChart } from '../render/chart';

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function svgBlob(piece: Piece): Blob {
  const { svg } = renderChart(piece);
  return new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + svg], { type: 'image/svg+xml;charset=utf-8' });
}

/** Rasterises the chart. `scale` multiplies the SVG's natural size (900 px wide for a 120-bar piece). */
export async function pngBlob(piece: Piece, scale: number): Promise<Blob> {
  const { svg, width, height } = renderChart(piece);
  const img = new Image();
  img.decoding = 'async';
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('SVG could not be rasterised'));
  });
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await loaded;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'),
  );
}

const FORMAT = 'tonartenverlauf';

export function projectBlob(pieces: Piece[]): Blob {
  const body = JSON.stringify({ format: FORMAT, version: 1, pieces }, null, 2);
  return new Blob([body], { type: 'application/json' });
}

export function projectFileName(piece: Piece): string {
  return `${fileSlug(piece)}.tonart.json`;
}

/** Reads a project file (single piece, bundle, or a bare piece object). Throws on garbage. */
export async function readProjectFile(file: File): Promise<Piece[]> {
  const data = JSON.parse(await file.text());
  const candidates: unknown[] = Array.isArray(data?.pieces) ? data.pieces : data?.piece ? [data.piece] : [data];
  const pieces = candidates.map(normalizePiece).filter((p): p is Piece => p !== null);
  if (pieces.length === 0) throw new Error('no pieces');
  return pieces;
}

export function freshIdentity(piece: Piece): Piece {
  const now = Date.now();
  return { ...piece, id: newId(), createdAt: now, updatedAt: now };
}
