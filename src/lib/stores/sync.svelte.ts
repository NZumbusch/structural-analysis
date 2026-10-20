import { normalizePiece } from '../domain/piece';
import { requestToken, revokeToken } from '../sync/auth';
import { createDrive, DriveError } from '../sync/drive';
import { runSync, type SyncReport } from '../sync/engine';
import { app } from './app.svelte';
import { emptySync, savePrefs } from './storage';

export type SyncStatus = 'off' | 'signed-out' | 'idle' | 'syncing' | 'error';

/** Build-time default, so one setting in the repository serves every device. */
const BUILT_IN_CLIENT_ID: string = (import.meta.env?.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';

const AUTO_DELAY_MS = 15_000;
const STALE_MS = 60_000;

class SyncStore {
  status = $state<SyncStatus>('off');
  /** Machine-readable reason of the last problem; the UI turns it into text. */
  problem = $state('');
  report = $state<SyncReport | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;

  get prefs() {
    return app.prefs.sync;
  }
  get clientId(): string {
    return this.prefs.clientId || BUILT_IN_CLIENT_ID;
  }
  get builtIn(): boolean {
    return !this.prefs.clientId && !!BUILT_IN_CLIENT_ID;
  }
  get tokenValid(): boolean {
    return !!this.prefs.token && Date.now() < this.prefs.tokenExpires - 60_000;
  }

  /** Call once at start. */
  init(): void {
    app.onChange = () => this.schedule();
    this.status = this.prefs.enabled ? (this.tokenValid ? 'idle' : 'signed-out') : 'off';
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && this.refresh());
      window.addEventListener('online', () => this.refresh());
    }
    this.refresh();
  }

  setClientId(id: string): void {
    this.prefs.clientId = id.trim();
    savePrefs(app.prefs);
  }

  /** Syncs if it is switched on, signed in and a while ago. */
  refresh(): void {
    if (!this.prefs.enabled) return;
    if (!this.tokenValid) {
      this.status = 'signed-out';
      return;
    }
    if (Date.now() - this.prefs.lastSync > STALE_MS) void this.syncNow();
  }

  private schedule(): void {
    if (!this.prefs.enabled || !this.tokenValid) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.syncNow(), AUTO_DELAY_MS);
  }

  /** Asks Google for access (needs a click) and syncs. */
  async signIn(): Promise<void> {
    this.problem = '';
    if (!this.clientId) {
      this.problem = 'no-client';
      this.status = 'error';
      return;
    }
    try {
      const first = !this.prefs.enabled;
      const t = await requestToken(this.clientId, first ? 'consent' : '');
      this.prefs.token = t.token;
      this.prefs.tokenExpires = t.expiresAt;
      this.prefs.enabled = true;
      savePrefs(app.prefs);
      this.status = 'idle';
    } catch (e) {
      this.status = this.prefs.enabled ? 'signed-out' : 'off';
      this.problem = e instanceof Error ? e.message : 'denied';
      return;
    }
    await this.syncNow();
  }

  /** Stops syncing; pieces stay here and on Drive. */
  disconnect(): void {
    clearTimeout(this.timer);
    if (this.prefs.token) revokeToken(this.prefs.token);
    Object.assign(this.prefs, emptySync(), { clientId: this.prefs.clientId });
    savePrefs(app.prefs);
    this.status = 'off';
    this.problem = '';
    this.report = null;
  }

  async syncNow(): Promise<void> {
    if (this.running || !this.prefs.enabled) return;
    if (!this.tokenValid) {
      this.status = 'signed-out';
      return;
    }
    if (app.hasUnsavedEdits) {
      this.schedule();
      return;
    }
    this.running = true;
    this.status = 'syncing';
    this.problem = '';
    try {
      const drive = createDrive(() => this.prefs.token);
      this.report = await runSync({
        drive,
        pieces: [...app.library],
        state: this.prefs,
        storeSynced: (p) => app.storeSynced(p),
        removeSynced: (id) => app.remove(id, false),
        addCopy: (p) => app.addCopy(p, app.prefs.uiLang === 'de' ? '(Konflikt)' : '(conflict)'),
        parse: (text) => {
          try {
            return normalizePiece(JSON.parse(text));
          } catch {
            return null;
          }
        },
      });
      this.prefs.lastSync = Date.now();
      this.status = this.report.failed > 0 ? 'error' : 'idle';
      if (this.report.failed > 0) this.problem = 'partial';
    } catch (e) {
      if (e instanceof DriveError && e.status === 401) {
        this.prefs.token = '';
        this.prefs.tokenExpires = 0;
        this.status = 'signed-out';
      } else {
        this.status = 'error';
        this.problem = e instanceof DriveError ? (e.status === 0 ? 'network' : `http-${e.status}:${e.message}`) : 'network';
      }
    } finally {
      savePrefs(app.prefs);
      this.running = false;
    }
  }
}

export const sync = new SyncStore();
