import { displayTitle, fileSlug, normalizePiece } from '../domain/piece';
import { newId } from '../domain/ids';
import type { Piece } from '../domain/types';
import { renderChart, type ViewRange } from '../render/chart';
import { zip, type ZipEntry } from './zip';

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

export interface ExportOptions {
  view?: ViewRange | null;
  /** Physical width of SVG/PDF output in cm. */
  widthCm?: number;
}

export function svgBlob(piece: Piece, options: ExportOptions = {}): Blob {
  const { svg } = renderChart(piece, options);
  return new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + svg], { type: 'image/svg+xml;charset=utf-8' });
}

/** Chart size in chart units, so callers can turn a scale or a cm/dpi request into pixels. */
export function chartSize(piece: Piece, view?: ViewRange | null): { width: number; height: number } {
  const { width, height } = renderChart(piece, { view });
  return { width, height };
}

/** Rasterises the chart. Give either `scale` (multiplies the natural size) or `pixelWidth`. */
export async function pngBlob(
  piece: Piece,
  options: { view?: ViewRange | null; scale?: number; pixelWidth?: number },
): Promise<Blob> {
  const { svg, width, height } = renderChart(piece, { view: options.view });
  const factor = options.pixelWidth ? options.pixelWidth / width : (options.scale ?? 2);
  const img = new Image();
  img.decoding = 'async';
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('SVG could not be rasterised'));
  });
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await loaded;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * factor);
  canvas.height = Math.round(height * factor);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'),
  );
}

/** Every view of the piece (and the whole chart) as one ZIP of SVG or PNG files. */
export async function viewsZip(
  piece: Piece,
  kind: 'svg' | 'png',
  base: string,
  options: { widthCm?: number; scale?: number; pixelWidth?: number },
): Promise<Blob> {
  const entries: ZipEntry[] = [];
  const targets: { name: string; view: ViewRange | null }[] = [
    { name: base, view: null },
    ...piece.views.map((v, i) => ({
      name: `${base}-${String(i + 1).padStart(2, '0')}-${slugify(v.name) || 'ausschnitt'}`,
      view: { from: v.from, to: v.to },
    })),
  ];
  for (const t of targets) {
    const blob = kind === 'svg' ? svgBlob(piece, { view: t.view, widthCm: options.widthCm }) : await pngBlob(piece, { view: t.view, ...options });
    entries.push({ name: `${t.name}.${kind}`, data: new Uint8Array(await blob.arrayBuffer()) });
  }
  return new Blob([zip(entries) as BlobPart], { type: 'application/zip' });
}

/**
 * Opens the browser's print dialog with only the chart on a page of exactly its size
 * ("Save as PDF" there gives a vector PDF with live text).
 */
export function printPdf(piece: Piece, options: ExportOptions = {}): void {
  const { svg, width, height } = renderChart(piece, options);
  const cmW = options.widthCm ?? (width / 96) * 2.54;
  const cmH = (cmW * height) / width;
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(
    `<!doctype html><title>${esc(displayTitle(piece) || 'Tonartenverlauf')}</title><style>` +
      `@page{size:${cmW.toFixed(3)}cm ${cmH.toFixed(3)}cm;margin:0}` +
      `html,body{margin:0;padding:0}svg{display:block;-webkit-print-color-adjust:exact;print-color-adjust:exact}</style>` +
      svg.replace(/width="[^"]*" height="[^"]*"/, `width="${cmW.toFixed(3)}cm" height="${cmH.toFixed(3)}cm"`),
  );
  doc.close();
  const win = frame.contentWindow!;
  win.onafterprint = () => frame.remove();
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(() => frame.remove(), 60_000);
  }, 150);
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function slugify(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
