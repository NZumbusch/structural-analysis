import { displayTitle, fileSlug, normalizePiece } from '../domain/piece';
import { newId } from '../domain/ids';
import type { Piece } from '../domain/types';
import { renderChart, type ViewRange } from '../render/chart';
import { stampOf, withPngText, withSvgMetadata, APP_NAME, APP_VERSION } from './stamp';
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

/** How fonts go into an export: bundled font embedded, text turned into outlines, or left to the viewer. */
export type FontMode = 'embed' | 'outline' | 'none';

export interface ExportOptions {
  view?: ViewRange | null;
  /** Physical width of SVG/PDF output in cm. */
  widthCm?: number;
  fonts?: FontMode;
  /** Write app version, date and provenance into the file (default true). */
  stamp?: boolean;
}

/** Applies the font mode to an SVG string. `missing` counts text that could not be outlined. */
export async function prepareSvg(svg: string, mode: FontMode = 'embed'): Promise<{ svg: string; missing: number }> {
  // the font and PDF code is loaded only when something is exported
  if (mode === 'embed') return { svg: await (await import('./fontdata')).embedFonts(svg), missing: 0 };
  if (mode === 'outline') return (await import('./fontdata')).outlineText(svg);
  return { svg, missing: 0 };
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n';

export async function svgBlob(piece: Piece, options: ExportOptions = {}): Promise<{ blob: Blob; missing: number }> {
  const { svg } = renderChart(piece, options);
  const prepared = await prepareSvg(options.stamp === false ? svg : withSvgMetadata(svg, stampOf(piece)), options.fonts);
  return { blob: new Blob([XML_HEAD + prepared.svg], { type: 'image/svg+xml;charset=utf-8' }), missing: prepared.missing };
}

/** A vector PDF of the chart, with the font embedded (or text outlined). */
export async function pdfBlob(piece: Piece, options: ExportOptions = {}): Promise<{ blob: Blob; missing: number }> {
  const { svg } = renderChart(piece, { view: options.view });
  const prepared = options.fonts === 'outline' ? await prepareSvg(svg, 'outline') : { svg, missing: 0 };
  const { svgToPdf } = await import('./pdf');
  const stamp = stampOf(piece);
  const pdf = await svgToPdf(prepared.svg, {
    widthCm: options.widthCm,
    title: displayTitle(piece) || undefined,
    ...(options.stamp === false ? {} : { author: stamp.analyst || stamp.composer, subject: stamp.source, creator: `${APP_NAME} ${APP_VERSION}`, date: new Date() }),
  });
  return { blob: new Blob([pdf as BlobPart], { type: 'application/pdf' }), missing: prepared.missing };
}

/** Chart size in chart units, so callers can turn a scale or a cm/dpi request into pixels. */
export function chartSize(piece: Piece, view?: ViewRange | null): { width: number; height: number } {
  const { width, height } = renderChart(piece, { view });
  return { width, height };
}

/** Rasterises an SVG string. Give either `scale` (multiplies the natural size) or `pixelWidth`. */
export async function svgToPng(
  svg: string,
  width: number,
  height: number,
  options: { scale?: number; pixelWidth?: number },
): Promise<Blob> {
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

/** Rasterises the main chart. */
export async function pngBlob(
  piece: Piece,
  options: { view?: ViewRange | null; scale?: number; pixelWidth?: number; stamp?: boolean },
): Promise<Blob> {
  const { svg, width, height } = renderChart(piece, { view: options.view });
  const png = await svgToPng((await prepareSvg(svg, 'embed')).svg, width, height, options);
  if (options.stamp === false) return png;
  const bytes = withPngText(new Uint8Array(await png.arrayBuffer()), stampOf(piece), piece.meta.altText?.trim());
  return new Blob([bytes as BlobPart], { type: 'image/png' });
}

/** Every view of the piece (and the whole chart) as one ZIP of SVG or PNG files. */
export async function viewsZip(
  piece: Piece,
  kind: 'svg' | 'png' | 'pdf',
  base: string,
  options: { widthCm?: number; scale?: number; pixelWidth?: number; fonts?: FontMode; stamp?: boolean },
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
    const blob =
      kind === 'svg'
        ? (await svgBlob(piece, { view: t.view, widthCm: options.widthCm, fonts: options.fonts, stamp: options.stamp })).blob
        : kind === 'pdf'
          ? (await pdfBlob(piece, { view: t.view, widthCm: options.widthCm, fonts: options.fonts, stamp: options.stamp })).blob
          : await pngBlob(piece, { view: t.view, scale: options.scale, pixelWidth: options.pixelWidth, stamp: options.stamp });
    entries.push({ name: `${t.name}.${kind}`, data: new Uint8Array(await blob.arrayBuffer()) });
  }
  return new Blob([zip(entries) as BlobPart], { type: 'application/zip' });
}

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
  const body = JSON.stringify({ format: FORMAT, version: 1, app: { name: APP_NAME, version: APP_VERSION }, exportedAt: new Date().toISOString(), pieces }, null, 2);
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
