import { normalizePiece, normalizeStyle } from '../domain/piece';
import type { Lang, Piece, Style } from '../domain/types';

const PREFIX = 'tonartenverlauf.';
const INDEX_KEY = PREFIX + 'index';
const PREFS_KEY = PREFIX + 'prefs';
const pieceKey = (id: string) => PREFIX + 'piece.' + id;

/** Google Drive sync: what was last exchanged per piece, so changes on either side can be told apart. */
export interface SyncPrefs {
  enabled: boolean;
  /** OAuth client ID of the user's own Google Cloud project (a public identifier, not a secret). */
  clientId: string;
  /** Short-lived access token (about an hour) and when it ends (ms). */
  token: string;
  tokenExpires: number;
  /** Per piece id: the Drive file and the `updatedAt` that both sides had after the last sync. */
  files: Record<string, { fileId: string; syncedAt: number }>;
  /** Drive files of pieces deleted here, to be deleted there at the next sync. */
  deleted: string[];
  lastSync: number;
}

export function emptySync(): SyncPrefs {
  return { enabled: false, clientId: '', token: '', tokenExpires: 0, files: {}, deleted: [], lastSync: 0 };
}

export interface Prefs {
  sync: SyncPrefs;
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
  const s = (raw?.sync ?? {}) as Partial<SyncPrefs>;
  const sync: SyncPrefs = {
    enabled: s.enabled === true,
    clientId: typeof s.clientId === 'string' ? s.clientId : '',
    token: typeof s.token === 'string' ? s.token : '',
    tokenExpires: typeof s.tokenExpires === 'number' ? s.tokenExpires : 0,
    files: s.files && typeof s.files === 'object' ? s.files : {},
    deleted: Array.isArray(s.deleted) ? s.deleted.filter((x): x is string => typeof x === 'string') : [],
    lastSync: typeof s.lastSync === 'number' ? s.lastSync : 0,
  };
  return {
    sync,
    uiLang: raw?.uiLang === 'de' || raw?.uiLang === 'en' ? raw.uiLang : typeof navigator !== 'undefined' && /^en/i.test(navigator.language ?? '') ? 'en' : 'de',
    lastOpenId: raw?.lastOpenId ?? null,
    defaultStyle: raw?.defaultStyle ? normalizeStyle(raw.defaultStyle) : null,
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
    .map((id) => {
      try {
        return typeof id === 'string' ? normalizePiece(read(pieceKey(id))) : null;
      } catch {
        return null; // one damaged piece must not keep the app from starting
      }
    })
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
