import { cloneStyle, DEFAULT_STYLE } from '../domain/piece';
import type { Piece } from '../domain/types';
import type { TKey } from '../i18n/index.svelte';
import { renderChart, type ViewRange } from '../render/chart';
import { PALETTES } from '../render/palettes';
import type { ExportPrefs } from './prefs';
import { fitFontScale } from './fit';

export type PresetId = 'column-bw' | 'text-bw' | 'text-color' | 'slide' | 'screen';

export interface Preset {
  id: PresetId;
  label: TKey;
  widthCm: number;
  /** Printed size of the row labels the preset aims for. */
  targetPt: number;
  dpi: number;
}

export const PRESETS: Preset[] = [
  { id: 'column-bw', label: 'set.p.column-bw', widthCm: 8.5, targetPt: 7, dpi: 600 },
  { id: 'text-bw', label: 'set.p.text-bw', widthCm: 16, targetPt: 8, dpi: 600 },
  { id: 'text-color', label: 'set.p.text-color', widthCm: 16, targetPt: 8, dpi: 300 },
  { id: 'slide', label: 'set.p.slide', widthCm: 25, targetPt: 14, dpi: 300 },
  { id: 'screen', label: 'set.p.screen', widthCm: 16, targetPt: 8, dpi: 300 },
];

export const WIDTH_CHOICES: { key: TKey; cm: number }[] = [
  { key: 'set.w.1', cm: 8.5 },
  { key: 'set.w.2', cm: 12 },
  { key: 'set.w.3', cm: 16 },
  { key: 'set.w.4', cm: 24 },
];

const palette = (id: string) => ({ ...PALETTES.find((p) => p.id === id)!.colors });

/** Sets the look for a kind of publication in one go, then fits the text size to the chosen width. */
export function applyPreset(piece: Piece, exp: ExportPrefs, preset: Preset, view?: ViewRange | null): void {
  const st = piece.style;
  const bw = preset.id === 'column-bw' || preset.id === 'text-bw';
  const print = preset.id !== 'slide' && preset.id !== 'screen';

  st.colors = palette(bw ? 'mono' : preset.id === 'screen' ? 'classic' : 'vivid');
  st.hatch = bw;
  st.margins = preset.id === 'screen' ? 'normal' : 'tight';
  st.show.title = !print;
  st.show.subtitle = preset.id === 'screen';
  st.lineScale = 1;
  st.fontScale = cloneStyle(DEFAULT_STYLE).fontScale;

  exp.mode = preset.id === 'screen' ? 'scale' : 'physical';
  exp.widthCm = preset.widthCm;
  exp.dpi = preset.dpi;
  exp.targetPt = preset.targetPt;
  if (preset.id === 'screen') return;
  st.fontScale = fitFontScale(piece, preset.widthCm, preset.targetPt, view);
  // thin lines vanish in print: raise the line weight until the thinnest one is about 0.3 pt
  const chart = renderChart({ ...piece, style: { ...st, lineScale: 1 } }, { view });
  const widths = [...chart.svg.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1])).filter((w) => w > 0);
  const ptPerUnit = ((preset.widthCm / 2.54) * 72) / chart.width;
  const needed = widths.length ? 0.3 / (Math.min(...widths) * ptPerUnit) : 1;
  st.lineScale = Math.min(3, Math.max(preset.id === 'slide' ? 1.4 : 1, Math.ceil(needed * 10) / 10));
}
