/** Rough RGB -> CMYK conversion (no colour profile), for communicating colours to a publisher. */
export function toCmyk(hex: string): { c: number; m: number; y: number; k: number } {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  const channel = (v: number) => Math.round(((1 - v - k) / (1 - k)) * 100);
  return { c: channel(r), m: channel(g), y: channel(b), k: Math.round(k * 100) };
}
