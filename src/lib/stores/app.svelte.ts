import { createExample } from '../domain/example';
import { cloneStyle, createPiece, DEFAULT_STYLE } from '../domain/piece';
import type { Piece } from '../domain/types';
import { freshIdentity, readProjectFile } from '../export/files';
import type { Snap } from '../domain/positions';
import { deletePiece, loadAllPieces, loadPrefs, savePiece, savePrefs } from './storage';

export type Tab = 'library' | 'piece' | 'analysis' | 'stats' | 'export';
export type SaveState = 'saved' | 'saving' | 'error';
export type SelectionKind = 'segment' | 'passing' | 'annotation' | 'marker';
export interface Selection {
  kind: SelectionKind;
  id: string;
}

const HISTORY_LIMIT = 100;
const COALESCE_MS = 700;

/** The JSON used for change detection; ignores updatedAt so saving does not retrigger itself. */
export function fingerprint(piece: Piece): string {
  return JSON.stringify(piece, (key, value) => (key === 'updatedAt' ? undefined : value));
}

class AppState {
  tab = $state<Tab>('library');
  piece = $state<Piece | null>(null);
  /** Last saved snapshot of every stored piece (what the library shows). */
  library = $state.raw<Piece[]>([]);
  prefs = $state(loadPrefs());
  saveState = $state<SaveState>('saved');
  toast = $state('');

  /** Element picked in the preview; the matching editor row is highlighted. */
  selection = $state<Selection | null>(null);
  /** Zoom view shown in previews (null = whole piece). */
  activeViewId = $state<string | null>(null);
  /** Grid that dragging in the preview snaps to. */
  snap = $state<Snap>('beat');
  /** Whether the preview reacts to clicks and drags. */
  editInPreview = $state(true);

  historyIndex = $state(0);
  historyLength = $state(0);
  private history: string[] = [];
  private lastPush = 0;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.library = loadAllPieces().sort((a, b) => b.updatedAt - a.updatedAt);
    const last = this.library.find((p) => p.id === this.prefs.lastOpenId);
    if (last) {
      this.open(last, 'analysis');
    }
  }

  get canUndo(): boolean {
    return this.historyIndex > 0;
  }
  get canRedo(): boolean {
    return this.historyIndex < this.historyLength - 1;
  }

  notify(message: string): void {
    this.toast = message;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = ''), 4000);
  }

  // ---- opening and creating -----------------------------------------------------------------
  open(piece: Piece, tab: Tab = 'analysis'): void {
    this.piece = JSON.parse(JSON.stringify(piece));
    this.history = [fingerprint(this.piece!)];
    this.historyIndex = 0;
    this.historyLength = 1;
    this.prefs.lastOpenId = piece.id;
    this.selection = null;
    this.activeViewId = null;
    savePrefs(this.prefs);
    this.tab = tab;
  }

  private add(piece: Piece, tab: Tab): void {
    this.commit(piece);
    this.open(piece, tab);
  }

  create(): void {
    this.add(createPiece({}, this.prefs.defaultStyle ?? DEFAULT_STYLE), 'piece');
  }

  createExample(): void {
    this.add(createExample(), 'analysis');
  }

  duplicate(piece: Piece): void {
    const copy = freshIdentity(JSON.parse(JSON.stringify(piece)));
    copy.meta.title = copy.meta.title ? `${copy.meta.title} (Kopie)` : '(Kopie)';
    this.commit(copy);
  }

  /** Imports pieces; those whose id already exists get a new identity so nothing is overwritten. */
  importPieces(pieces: Piece[]): Piece[] {
    const existing = new Set(this.library.map((p) => p.id));
    const added = pieces.map((p) => (existing.has(p.id) ? freshIdentity(p) : p));
    for (const p of added) this.commit(p);
    return added;
  }

  /** Imports project files chosen or dropped by the user; reports the result as a toast. */
  async importFiles(files: FileList | File[], translate: (ok: boolean, n: number) => string): Promise<void> {
    const imported: Piece[] = [];
    try {
      for (const file of Array.from(files)) imported.push(...(await readProjectFile(file)));
    } catch {
      this.notify(translate(false, 0));
      return;
    }
    const added = this.importPieces(imported);
    this.notify(translate(true, added.length));
    if (added.length === 1) this.open(added[0], 'analysis');
  }

  remove(id: string): void {
    deletePiece(id);
    this.library = this.library.filter((p) => p.id !== id);
    if (this.piece?.id === id) {
      this.piece = null;
      this.prefs.lastOpenId = null;
      savePrefs(this.prefs);
    }
  }

  /** Removes the selected element from its list. */
  deleteSelection(): boolean {
    const sel = this.selection;
    const piece = this.piece;
    if (!sel || !piece) return false;
    const lists = {
      segment: piece.segments,
      passing: piece.passing,
      annotation: piece.annotations,
      marker: piece.markers,
    } as const;
    const list = lists[sel.kind] as { id: string }[];
    const i = list.findIndex((x) => x.id === sel.id);
    if (i < 0) return false;
    list.splice(i, 1);
    this.selection = null;
    return true;
  }

  // ---- persistence ------------------------------------------------------------------------------
  /** Writes a snapshot to localStorage and the library list. */
  private commit(piece: Piece): void {
    const snapshot: Piece = JSON.parse(JSON.stringify(piece));
    snapshot.updatedAt = Date.now();
    const ok = savePiece(snapshot);
    this.saveState = ok ? 'saved' : 'error';
    if (!ok) this.notify('storage');
    this.library = [snapshot, ...this.library.filter((p) => p.id !== snapshot.id)];
  }

  saveCurrent(): void {
    if (this.piece) this.commit(this.piece);
  }

  // ---- undo / redo ----------------------------------------------------------------------------------
  /** Called after every change of the open piece. */
  track(json: string): void {
    if (json === this.history[this.historyIndex]) return;
    const now = Date.now();
    const atTip = this.historyIndex === this.history.length - 1;
    if (atTip && this.historyIndex > 0 && now - this.lastPush < COALESCE_MS) {
      this.history[this.historyIndex] = json;
    } else {
      this.history = [...this.history.slice(0, this.historyIndex + 1), json].slice(-HISTORY_LIMIT);
      this.historyIndex = this.history.length - 1;
    }
    this.historyLength = this.history.length;
    this.lastPush = now;
  }

  private restore(index: number): void {
    this.historyIndex = index;
    this.piece = JSON.parse(this.history[index]);
    this.lastPush = 0;
  }

  undo(): void {
    if (this.canUndo) this.restore(this.historyIndex - 1);
  }
  redo(): void {
    if (this.canRedo) this.restore(this.historyIndex + 1);
  }

  // ---- preferences ----------------------------------------------------------------------------------------
  setUiLang(lang: 'de' | 'en'): void {
    this.prefs.uiLang = lang;
    savePrefs(this.prefs);
  }

  saveDefaultStyle(): void {
    if (!this.piece) return;
    this.prefs.defaultStyle = cloneStyle(this.piece.style);
    savePrefs(this.prefs);
  }
}

export const app = new AppState();
