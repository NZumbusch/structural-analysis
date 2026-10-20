declare module 'opentype.js' {
  export interface Glyph {
    index: number;
    advanceWidth: number;
    getPath(x?: number, y?: number, fontSize?: number): Path;
  }
  export interface Path {
    toPathData(decimals?: number): string;
  }
  export interface Font {
    unitsPerEm: number;
    ascender: number;
    descender: number;
    glyphs: { get(index: number): Glyph; length: number };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tables: Record<string, any>;
    charToGlyphIndex(char: string): number;
    getAdvanceWidth(text: string, fontSize: number, options?: { kerning?: boolean }): number;
    getPath(text: string, x: number, y: number, fontSize: number, options?: { kerning?: boolean }): Path;
  }
  export function parse(buffer: ArrayBuffer): Font;
}
