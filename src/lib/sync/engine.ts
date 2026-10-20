import type { Piece } from '../domain/types';
import { DriveError, type Drive, type RemoteFile } from './drive';
import type { SyncPrefs } from '../stores/storage';

export interface SyncReport {
  uploaded: number;
  downloaded: number;
  /** Pieces edited on both sides: the newer one won, the other one is kept as a copy. */
  conflicts: number;
  deletedHere: number;
  deletedThere: number;
  failed: number;
}

export interface SyncDeps {
  drive: Drive;
  /** The library as it is now. */
  pieces: Piece[];
  /** What the last sync exchanged; updated in place. */
  state: Pick<SyncPrefs, 'files' | 'deleted'>;
  /** Stores a piece that came from Drive exactly as it is (its `updatedAt` stays). */
  storeSynced(piece: Piece): void;
  removeSynced(id: string): void;
  /** Keeps a losing conflict version as a new piece of its own and returns it. */
  addCopy(piece: Piece): Piece;
  parse(text: string): Piece | null;
}

const same = (a: Piece, b: Piece) => {
  const f = (p: Piece) => JSON.stringify(p, (k, v) => (k === 'updatedAt' ? undefined : v));
  return f(a) === f(b);
};

/**
 * Brings the library and the Drive folder to the same state. Per piece, with `base` the `updatedAt` both
 * sides had after the last sync: only here changed -> upload; only there -> download; both -> the newer one
 * wins and the other is kept as a copy (nothing is lost); gone on one side and untouched on the other -> gone
 * on both. Throws on sign-in problems; other failures are counted per piece.
 */
export async function runSync(deps: SyncDeps): Promise<SyncReport> {
  const { drive, state } = deps;
  const report: SyncReport = { uploaded: 0, downloaded: 0, conflicts: 0, deletedHere: 0, deletedThere: 0, failed: 0 };
  const guard = async (work: () => Promise<void>) => {
    try {
      await work();
    } catch (e) {
      if (e instanceof DriveError && (e.status === 401 || e.status === 403)) throw e;
      report.failed++;
    }
  };

  // deletions made here
  for (const fileId of [...state.deleted]) {
    await guard(async () => {
      await drive.remove(fileId);
      state.deleted = state.deleted.filter((f) => f !== fileId);
      report.deletedThere++;
    });
  }

  // one file per piece: if two devices created the same piece, keep the newest
  const all = await drive.list();
  const remote = new Map<string, RemoteFile>();
  for (const f of all.sort((a, b) => a.updatedAt - b.updatedAt)) {
    const old = remote.get(f.pieceId);
    if (old) await guard(() => drive.remove(old.id));
    remote.set(f.pieceId, f);
  }
  const pendingDelete = new Set(state.deleted);
  for (const id of pendingDelete) for (const [k, f] of remote) if (f.id === id) remote.delete(k);

  const upload = async (p: Piece, fileId?: string) => {
    let id: string;
    try {
      id = await drive.upload(p.id, p.updatedAt, JSON.stringify(p), fileId);
    } catch (e) {
      if (!(fileId && e instanceof DriveError && e.status === 404)) throw e;
      id = await drive.upload(p.id, p.updatedAt, JSON.stringify(p)); // the file was removed meanwhile
    }
    state.files[p.id] = { fileId: id, syncedAt: p.updatedAt };
    report.uploaded++;
  };
  const download = async (r: RemoteFile): Promise<Piece | null> => {
    const piece = deps.parse(await drive.download(r.id));
    if (piece) piece.updatedAt = r.updatedAt || piece.updatedAt;
    return piece;
  };

  const queue = [...deps.pieces];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    const r = remote.get(p.id);
    const known = state.files[p.id];
    await guard(async () => {
      if (!r) {
        if (known && p.updatedAt <= known.syncedAt) {
          deps.removeSynced(p.id); // deleted on another device, not touched here since
          delete state.files[p.id];
          report.deletedHere++;
        } else await upload(p);
        return;
      }
      const base = known?.syncedAt ?? 0;
      const localChanged = p.updatedAt > base;
      const remoteChanged = r.updatedAt > base;
      if (!localChanged && !remoteChanged) {
        state.files[p.id] = { fileId: r.id, syncedAt: base };
      } else if (localChanged && !remoteChanged) {
        await upload(p, r.id);
      } else if (remoteChanged && !localChanged) {
        const incoming = await download(r);
        if (!incoming) return void report.failed++;
        deps.storeSynced(incoming);
        state.files[p.id] = { fileId: r.id, syncedAt: incoming.updatedAt };
        report.downloaded++;
      } else {
        const incoming = await download(r);
        if (!incoming) return void report.failed++;
        if (same(incoming, p)) {
          state.files[p.id] = { fileId: r.id, syncedAt: Math.max(p.updatedAt, incoming.updatedAt) };
          if (incoming.updatedAt > p.updatedAt) deps.storeSynced(incoming);
          return;
        }
        report.conflicts++;
        if (incoming.updatedAt > p.updatedAt) {
          queue.push(deps.addCopy(p));
          deps.storeSynced(incoming);
          state.files[p.id] = { fileId: r.id, syncedAt: incoming.updatedAt };
          report.downloaded++;
        } else {
          queue.push(deps.addCopy(incoming));
          await upload(p, r.id);
        }
      }
    });
  }

  // pieces that exist only on Drive
  const local = new Set(queue.map((p) => p.id));
  for (const r of remote.values()) {
    if (local.has(r.pieceId)) continue;
    await guard(async () => {
      const incoming = await download(r);
      if (!incoming) return void report.failed++;
      deps.storeSynced(incoming);
      state.files[incoming.id] = { fileId: r.id, syncedAt: incoming.updatedAt };
      report.downloaded++;
    });
  }
  return report;
}
