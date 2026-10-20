import { newId } from '../domain/ids';
import { normalizePiece } from '../domain/piece';
import type { Piece } from '../domain/types';

/** Above this a link may be cut off by chat apps and servers; offer the file instead. */
export const LINK_WARN_LENGTH = 6000;

const b64 = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64 = (text: string) => {
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (ch) => ch.charCodeAt(0));
};

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([data as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** The piece as compact deflate+base64url text (ids are dropped; they are regenerated on import). */
export async function encodePiece(piece: Piece): Promise<string> {
  const json = JSON.stringify(piece, (key, value) => (key === 'id' || key === 'updatedAt' || key === 'createdAt' ? undefined : value));
  return b64(await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw')));
}

export async function decodePiece(code: string): Promise<Piece | null> {
  try {
    const json = new TextDecoder().decode(await pipe(unb64(code), new DecompressionStream('deflate-raw')));
    const piece = normalizePiece(JSON.parse(json));
    return piece ? { ...piece, id: newId() } : null;
  } catch {
    return null;
  }
}

export async function shareLink(piece: Piece): Promise<string> {
  const base = location.origin + location.pathname;
  return `${base}#p=${await encodePiece(piece)}`;
}

/** The code in the current URL hash, if any. */
export function codeFromHash(hash: string): string | null {
  const m = hash.match(/^#p=([A-Za-z0-9_-]+)$/);
  return m ? m[1] : null;
}
