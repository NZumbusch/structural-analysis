import type { FontMode } from './files';

/** What the export and print settings hold while the export tab is open (not part of the piece). */
export interface ExportPrefs {
  /** Size by scale factor (screen) or by printed width (physical). */
  mode: 'scale' | 'physical';
  scale: number;
  widthCm: number;
  dpi: number;
  fonts: FontMode;
  stamp: boolean;
  /** Row-label size in pt that "Fit text" aims for. */
  targetPt: number;
  /** Preview in greys, to see how the picture survives a black-and-white print. */
  grayscale: boolean;
}

export const defaultExportPrefs = (): ExportPrefs => ({
  mode: 'scale',
  scale: 3,
  widthCm: 16,
  dpi: 300,
  fonts: 'embed',
  stamp: true,
  targetPt: 8,
  grayscale: false,
});
