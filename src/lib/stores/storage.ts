import { normalizePiece } from '../domain/piece';
import type { Lang, Piece, Style } from '../domain/types';

const PREFIX = 'tonartenverlauf.';
const INDEX_KEY = PREFIX + 'index';
const PREFS_KEY = PREFIX + 'prefs';
const pieceKey = (id: string) => PREFIX + 'piece.' + id;

export interface Prefs {
  uiLang: Lang;
  lastOpenId: string | null;
  defaultStyle: Style | null;
  /** When each piece was last saved as a file (ms), to remind about backups. */
  backups: Record<string, number>;
  /** On phones, hide rarely needed features (the full version stays one tap away). */
  simpleOnMobile: boolean;
}

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadPrefs(): Prefs {
  const raw = read(PREFS_KEY) as Partial<Prefs> | null;
  return {
    uiLang: raw?.uiLang === 'de' || raw?.uiLang === 'en' ? raw.uiLang : 'de',
    lastOpenId: raw?.lastOpenId ?? null,
    defaultStyle: raw?.defaultStyle ?? null,
    backups: raw?.backups && typeof raw.backups === 'object' ? raw.backups : {},
    simpleOnMobile: raw?.simpleOnMobile !== false,
  };
}

export function savePrefs(prefs: Prefs): void {
  write(PREFS_KEY, prefs);
}

export function loadAllPieces(): Piece[] {
  const index = read(INDEX_KEY);
  if (!Array.isArray(index)) return [];
  return index
    .map((id) => (typeof id === 'string' ? normalizePiece(read(pieceKey(id))) : null))
    .filter((p): p is Piece => p !== null);
}

export function savePiece(piece: Piece): boolean {
  const index = read(INDEX_KEY);
  const ids = Array.isArray(index) ? (index as string[]) : [];
  if (!write(pieceKey(piece.id), piece)) return false;
  if (!ids.includes(piece.id)) return write(INDEX_KEY, [...ids, piece.id]);
  return true;
}

export function deletePiece(id: string): void {
  try {
    localStorage.removeItem(pieceKey(id));
  } catch {
    /* ignore */
  }
  const index = read(INDEX_KEY);
  if (Array.isArray(index)) write(INDEX_KEY, index.filter((x) => x !== id));
}
