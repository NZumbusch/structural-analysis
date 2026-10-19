import type { Palette } from '../domain/types';

export interface PalettePreset {
  id: string;
  colors: Palette;
}

export const PALETTES: PalettePreset[] = [
  {
    id: 'classic',
    colors: {
      majorFill: '#9FE1CB', majorStroke: '#0F6E56',
      minorFill: '#CECBF6', minorStroke: '#534AB7',
      text: '#2C2C2A', muted: '#6B6A65', grid: '#D3D1C7', axis: '#B4B2A9', link: '#888780',
      sectionBand: '#F1EFE8', centerBand: '#FAEEDA', surface: '#FFFFFF', background: '#FFFFFF',
    },
  },
  {
    id: 'vivid',
    colors: {
      majorFill: '#BFE0FF', majorStroke: '#0B5CAD',
      minorFill: '#FFD3C9', minorStroke: '#B3361E',
      text: '#1F2933', muted: '#667085', grid: '#D8DEE6', axis: '#B7C0CC', link: '#8794A5',
      sectionBand: '#EEF2F7', centerBand: '#FFF3C4', surface: '#FFFFFF', background: '#FFFFFF',
    },
  },
  {
    id: 'warm',
    colors: {
      majorFill: '#F6D6A8', majorStroke: '#9A5B13',
      minorFill: '#E7B8C9', minorStroke: '#8E3B5F',
      text: '#3A2E26', muted: '#7B6B5E', grid: '#E3D8CA', axis: '#CBBBA8', link: '#A39280',
      sectionBand: '#F4EDE2', centerBand: '#F8E5C9', surface: '#FFFBF5', background: '#FFFBF5',
    },
  },
  {
    id: 'mono',
    colors: {
      majorFill: '#ECECEC', majorStroke: '#2B2B2B',
      minorFill: '#B5B5B5', minorStroke: '#2B2B2B',
      text: '#111111', muted: '#555555', grid: '#D0D0D0', axis: '#999999', link: '#777777',
      sectionBand: '#F3F3F3', centerBand: '#E6E6E6', surface: '#FFFFFF', background: '#FFFFFF',
    },
  },
  {
    id: 'dark',
    colors: {
      majorFill: '#1F5C4A', majorStroke: '#6FD3B0',
      minorFill: '#3A3680', minorStroke: '#A9A3F2',
      text: '#ECEBE6', muted: '#A09E96', grid: '#3A3935', axis: '#55534D', link: '#8B8980',
      sectionBand: '#2A2926', centerBand: '#3A3226', surface: '#1E1E1C', background: '#1E1E1C',
    },
  },
];

export const CLASSIC: Palette = PALETTES[0].colors;

export function activePalette(colors: Palette): string | null {
  const hit = PALETTES.find((p) => (Object.keys(p.colors) as (keyof Palette)[]).every((k) => p.colors[k] === colors[k]));
  return hit?.id ?? null;
}
