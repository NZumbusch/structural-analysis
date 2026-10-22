import { createExample } from '../domain/example';
import { cloneStyle, createPiece, DEFAULT_STYLE, normalizeStyle } from '../domain/piece';
import type { Piece, Style } from '../domain/types';
import { downloadBlob, freshIdentity, projectBlob, projectFileName, readProjectFile } from '../export/files';
import type { Snap } from '../domain/positions';
import { deletePiece, loadAllPieces, loadPrefs, savePiece, savePrefs } from './storage';

/** The browser's "install as app" prompt (not in the standard DOM types). */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type Tab = 'library' | 'piece' | 'setup' | 'analysis' | 'stats' | 'look' | 'export';
export type SaveState = 'saved' | 'saving' | 'error';
export type SelectionKind = 'segment' | 'passing' | 'annotation' | 'event';
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
  /** The settings drawer (laptop) or page (everything else) is showing. */
  settingsOpen = $state(false);

  /** Element picked in the preview; the matching editor row is highlighted. */
  selection = $state<Selection | null>(null);
  /** Zoom view shown in previews (null = whole piece). */
  activeViewId = $state<string | null>(null);
  /** Grid that dragging in the preview snaps to. */
  snap = $state<Snap>('beat');
  /** Whether the preview reacts to clicks and drags. */
  editInPreview = $state(true);
  /** Phone-sized screen. */
  isMobile = $state(false);
  /** Set when the browser offers to install the app. */
  installEvent = $state.raw<InstallPromptEvent | null>(null);
  /** Running as an installed app already. */
  standalone = $state(false);
  /** iPhone/iPad Safari has no install prompt; it gets a hint instead. */
  showIosHint = $state(false);

  historyIndex = $state(0);
  historyLength = $state(0);
  private history: string[] = [];
  private lastPush = 0;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  /** Simple view: on a phone with the setting on, rare features are tucked away. */
  get simple(): boolean {
    return this.isMobile && this.prefs.simpleOnMobile;
  }

  constructor() {
    if (typeof matchMedia !== 'undefined') {
      const phone = matchMedia('(max-width: 700px)');
      this.isMobile = phone.matches;
      this.editInPreview = !phone.matches; // dragging in the preview fights with scrolling on touch screens
      phone.addEventListener('change', (e) => (this.isMobile = e.matches));
    }
    if (typeof window !== 'undefined') {
      this.standalone =
        (typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches) ||
        (navigator as unknown as { standalone?: boolean }).standalone === true;
      this.showIosHint = !this.standalone && /iphone|ipad|ipod/i.test(navigator.userAgent);
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.installEvent = e as InstallPromptEvent;
      });
      window.addEventListener('appinstalled', () => {
        this.installEvent = null;
        this.standalone = true;
      });
    }
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

  // ---- sync ----------------------------------------------------------------------------------------
  /** Called after every stored change; the sync uses it to schedule itself. */
  onChange: (() => void) | null = null;

  /** True while the open piece has edits that are not stored in the library yet. */
  get hasUnsavedEdits(): boolean {
    const stored = this.piece ? this.library.find((p) => p.id === this.piece!.id) : null;
    return !!this.piece && !!stored && fingerprint(stored) !== fingerprint(this.piece);
  }

  /** Stores a piece that came from sync as it is: its `updatedAt` is kept, so it does not look edited. */
  storeSynced(piece: Piece): void {
    const ok = savePiece(piece);
    if (!ok) this.notify('storage');
    this.library = [piece, ...this.library.filter((p) => p.id !== piece.id)].sort((a, b) => b.updatedAt - a.updatedAt);
    if (this.piece?.id === piece.id) this.open(piece, this.tab);
  }

  /** Keeps a version as a new piece (a conflict loser); it syncs like any new piece. */
  addCopy(piece: Piece, suffix: string): Piece {
    const copy = freshIdentity(JSON.parse(JSON.stringify(piece)) as Piece);
    copy.meta.title = `${copy.meta.title || ''} ${suffix}`.trim();
    this.commit(copy);
    return copy;
  }

  private add(piece: Piece, tab: Tab): void {
    this.commit(piece);
    this.open(piece, tab);
  }

  create(): void {
    this.add(createPiece({}, this.prefs.defaultStyle ? normalizeStyle(this.prefs.defaultStyle) : DEFAULT_STYLE), 'piece');
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

  remove(id: string, record = true): void {
    const synced = this.prefs.sync.files[id];
    if (record && synced) this.prefs.sync.deleted = [...this.prefs.sync.deleted, synced.fileId];
    delete this.prefs.sync.files[id];
    savePrefs(this.prefs);
    deletePiece(id);
    this.library = this.library.filter((p) => p.id !== id);
    this.onChange?.();
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
      event: piece.events,
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
    this.onChange?.();
  }

  /** Stores the open piece if it differs from the stored one (merely opening a piece is not an edit). */
  saveCurrent(): void {
    if (!this.piece) return;
    const stored = this.library.find((p) => p.id === this.piece!.id);
    if (stored && fingerprint(stored) === fingerprint(this.piece)) {
      this.saveState = 'saved';
      return;
    }
    this.commit(this.piece);
  }

  // ---- backups -------------------------------------------------------------------------------------
  /** Saves pieces as a project file and remembers when, so the app can remind about stale backups. */
  saveProjectFile(pieces: Piece[], filename?: string): void {
    if (pieces.length === 0) return;
    downloadBlob(projectBlob(pieces), filename ?? projectFileName(pieces[0]));
    const now = Date.now();
    this.prefs.backups = { ...this.prefs.backups, ...Object.fromEntries(pieces.map((p) => [p.id, now])) };
    savePrefs(this.prefs);
  }

  /** 'none' = never saved as a file, 'stale' = edited since, 'current' = file is up to date. */
  backupState(piece: Piece): 'none' | 'stale' | 'current' {
    const at = this.prefs.backups[piece.id];
    if (!at) return 'none';
    return piece.updatedAt > at + 1000 ? 'stale' : 'current';
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

  async install(): Promise<void> {
    const event = this.installEvent;
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === 'accepted') this.installEvent = null;
  }

  setSimple(on: boolean): void {
    this.prefs.simpleOnMobile = on;
    savePrefs(this.prefs);
  }

  /** The look new pieces start with: the saved default, or the built-in one. */
  get defaults(): Style {
    return this.prefs.defaultStyle ? normalizeStyle(this.prefs.defaultStyle) : DEFAULT_STYLE;
  }

  /** Changes single defaults for new pieces (note names, language of the graphic) and keeps the rest of the default look. */
  setDefaults(patch: Partial<Pick<Style, 'noteNames' | 'language'>>): void {
    this.prefs.defaultStyle = { ...cloneStyle(this.defaults), ...patch };
    savePrefs(this.prefs);
  }

  resetDefaults(): void {
    this.prefs.defaultStyle = null;
    savePrefs(this.prefs);
  }

  saveDefaultStyle(): void {
    if (!this.piece) return;
    this.prefs.defaultStyle = cloneStyle(this.piece.style);
    savePrefs(this.prefs);
  }
}

export const app = new AppState();
