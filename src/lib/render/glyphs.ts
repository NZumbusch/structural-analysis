/** Hand-drawn accidentals: the bundled fonts have no ♭ ♯ ♮, and drawn shapes also work in outlines and PDF. */

export type Accidental = 'sharp' | 'flat' | 'natural';

/** Width of an accidental of the given font size. */
export const accidentalWidth = (size: number) => size * 0.5;

/**
 * Draws an accidental sitting on the baseline at (x, y), about `size` tall.
 * Returned as a group of stroked paths.
 */
export function accidentalPath(kind: Accidental, x: number, y: number, size: number, color: string): string {
  const k = (size * 1.05) / 27; // the shapes below are drawn in a 27-unit-high box
  const shapes: string[] = [];
  const p = (d: string, w: number) =>
    shapes.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="butt" stroke-linejoin="round"/>`);
  if (kind === 'flat') {
    p('M2,-17 L2,1', 1.5);
    p('M2,-7 C6,-10 11.5,-6.5 11.5,-3 C11.5,0.5 6,2.5 2,1', 1.5);
  } else if (kind === 'sharp') {
    p('M3.6,-12 L3.6,6', 1.3);
    p('M7.6,-13 L7.6,5', 1.3);
    p('M1,-4.8 L10.4,-7.6', 2.4);
    p('M1,2 L10.4,-0.8', 2.4);
  } else {
    p('M3,-14 L3,1.5', 1.3);
    p('M8,-1.5 L8,14', 1.3);
    p('M3,-5.5 L8,-7', 2.2);
    p('M3,2 L8,0.5', 2.2);
  }
  return `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${k.toFixed(4)})">${shapes.join('')}</g>`;
}
