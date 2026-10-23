import type { FontFamilyId } from '../domain/types';
import sans400 from '@fontsource/inter/files/inter-latin-400-normal.woff?url';
import sans500 from '@fontsource/inter/files/inter-latin-500-normal.woff?url';
import sans400x from '@fontsource/inter/files/inter-latin-ext-400-normal.woff?url';
import sans500x from '@fontsource/inter/files/inter-latin-ext-500-normal.woff?url';
import serif400 from '@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff?url';
import serif500 from '@fontsource/source-serif-4/files/source-serif-4-latin-500-normal.woff?url';
import serif400x from '@fontsource/source-serif-4/files/source-serif-4-latin-ext-400-normal.woff?url';
import serif500x from '@fontsource/source-serif-4/files/source-serif-4-latin-ext-500-normal.woff?url';
import mono400 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff?url';
import mono500 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff?url';
import mono400x from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-ext-400-normal.woff?url';
import mono500x from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-ext-500-normal.woff?url';
import sans400c from '@fontsource/inter/files/inter-cyrillic-400-normal.woff?url';
import sans500c from '@fontsource/inter/files/inter-cyrillic-500-normal.woff?url';
import sans400g from '@fontsource/inter/files/inter-greek-400-normal.woff?url';
import sans500g from '@fontsource/inter/files/inter-greek-500-normal.woff?url';
import serif400c from '@fontsource/source-serif-4/files/source-serif-4-cyrillic-400-normal.woff?url';
import serif500c from '@fontsource/source-serif-4/files/source-serif-4-cyrillic-500-normal.woff?url';
import serif400g from '@fontsource/source-serif-4/files/source-serif-4-greek-400-normal.woff?url';
import serif500g from '@fontsource/source-serif-4/files/source-serif-4-greek-500-normal.woff?url';
import mono400c from '@fontsource/jetbrains-mono/files/jetbrains-mono-cyrillic-400-normal.woff?url';
import mono500c from '@fontsource/jetbrains-mono/files/jetbrains-mono-cyrillic-500-normal.woff?url';
import mono400g from '@fontsource/jetbrains-mono/files/jetbrains-mono-greek-400-normal.woff?url';
import mono500g from '@fontsource/jetbrains-mono/files/jetbrains-mono-greek-500-normal.woff?url';

/*
 * The charts use three bundled open fonts (SIL Open Font License): Inter, Source Serif 4 and JetBrains Mono.
 * They are used in the preview, and embedded into SVG/PDF or turned into outlines on export, so a figure
 * looks the same on every machine. Only weights 400 and 500 are used.
 */

export type Weight = 400 | 500;
export type Subset = 'latin' | 'latin-ext' | 'cyrillic' | 'greek';
export const SUBSETS: Subset[] = ['latin', 'latin-ext', 'cyrillic', 'greek'];

export interface FontFile {
  family: FontFamilyId;
  weight: Weight;
  subset: Subset;
  url: string;
}

/** CSS names; the first one is what charts put first in their font-family. */
export const FAMILY_NAME: Record<FontFamilyId, string> = {
  sans: 'Inter',
  serif: 'Source Serif 4',
  mono: 'JetBrains Mono',
};

export const FONT_STACK: Record<FontFamilyId, string> = {
  sans: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  serif: "'Source Serif 4', Georgia, 'Times New Roman', serif",
  mono: "'JetBrains Mono', Menlo, Consolas, 'Liberation Mono', monospace",
};

export const UNICODE_RANGE: Record<Subset, string> = {
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  cyrillic: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116',
  greek: 'U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF',
  'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
};

export const FONT_FILES: FontFile[] = [
  { family: 'sans', weight: 400, subset: 'latin', url: sans400 },
  { family: 'sans', weight: 500, subset: 'latin', url: sans500 },
  { family: 'sans', weight: 400, subset: 'latin-ext', url: sans400x },
  { family: 'sans', weight: 500, subset: 'latin-ext', url: sans500x },
  { family: 'serif', weight: 400, subset: 'latin', url: serif400 },
  { family: 'serif', weight: 500, subset: 'latin', url: serif500 },
  { family: 'serif', weight: 400, subset: 'latin-ext', url: serif400x },
  { family: 'serif', weight: 500, subset: 'latin-ext', url: serif500x },
  { family: 'mono', weight: 400, subset: 'latin', url: mono400 },
  { family: 'mono', weight: 500, subset: 'latin', url: mono500 },
  { family: 'mono', weight: 400, subset: 'latin-ext', url: mono400x },
  { family: 'mono', weight: 500, subset: 'latin-ext', url: mono500x },
  { family: 'sans', weight: 400, subset: 'cyrillic', url: sans400c },
  { family: 'sans', weight: 500, subset: 'cyrillic', url: sans500c },
  { family: 'sans', weight: 400, subset: 'greek', url: sans400g },
  { family: 'sans', weight: 500, subset: 'greek', url: sans500g },
  { family: 'serif', weight: 400, subset: 'cyrillic', url: serif400c },
  { family: 'serif', weight: 500, subset: 'cyrillic', url: serif500c },
  { family: 'serif', weight: 400, subset: 'greek', url: serif400g },
  { family: 'serif', weight: 500, subset: 'greek', url: serif500g },
  { family: 'mono', weight: 400, subset: 'cyrillic', url: mono400c },
  { family: 'mono', weight: 500, subset: 'cyrillic', url: mono500c },
  { family: 'mono', weight: 400, subset: 'greek', url: mono400g },
  { family: 'mono', weight: 500, subset: 'greek', url: mono500g },
];

export const fontFile = (family: FontFamilyId, weight: Weight, subset: Subset) =>
  FONT_FILES.find((f) => f.family === family && f.weight === weight && f.subset === subset)!;

/** Which family a CSS font-family list starts with. */
export function familyOf(cssFamily: string): FontFamilyId {
  const first = cssFamily.split(',')[0].replace(/['"]/g, '').trim();
  return (Object.keys(FAMILY_NAME) as FontFamilyId[]).find((k) => FAMILY_NAME[k] === first) ?? 'sans';
}

/** Makes the bundled fonts available to the page (loaded lazily by the browser as characters need them). */
export function registerFonts(): void {
  if (typeof document === 'undefined') return;
  const rules = FONT_FILES.map(
    (f) =>
      `@font-face{font-family:'${FAMILY_NAME[f.family]}';font-style:normal;font-display:swap;font-weight:${f.weight};` +
      `src:url(${f.url}) format('woff');unicode-range:${UNICODE_RANGE[f.subset]}}`,
  );
  const style = document.createElement('style');
  style.textContent = rules.join('\n');
  document.head.appendChild(style);
}

const RANGES = Object.fromEntries(
  SUBSETS.map((sub) => [
    sub,
    UNICODE_RANGE[sub].split(',').map((part) => part.replace('U+', '').split('-').map((h) => parseInt(h, 16)) as [number, number?]),
  ]),
) as Record<Subset, [number, number?][]>;

/** The bundled subset that is meant to hold a code point (latin first), or null when none is. */
export function subsetOf(cp: number): Subset | null {
  return SUBSETS.find((sub) => RANGES[sub].some(([a, b]) => cp >= a && cp <= (b ?? a))) ?? null;
}
