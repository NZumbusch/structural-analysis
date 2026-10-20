import type { Palette } from '../domain/types';

export const HATCH_ID = 'hatch-minor';
export const HATCH_FILL = `url(#${HATCH_ID})`;
export const HATCH_SIZE = 3.4;

/** Pattern for minor bars: the minor colour with diagonal lines, readable without colour. */
export function hatchDef(c: Palette): string {
  const s = HATCH_SIZE;
  return (
    `<pattern id="${HATCH_ID}" width="${s}" height="${s}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
    `<rect width="${s}" height="${s}" fill="${c.minorFill}"/>` +
    `<line x1="${s / 2}" y1="0" x2="${s / 2}" y2="${s}" stroke="${c.minorStroke}" stroke-width="1.1"/></pattern>`
  );
}
