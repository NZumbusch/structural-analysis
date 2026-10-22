import { describe, expect, it } from 'vitest';
import { createPiece, normalizePiece } from '../domain/piece';
import type { Piece } from '../domain/types';
import { createDrive, DriveError, type Drive, type RemoteFile } from './drive';
import { runSync, type SyncDeps } from './engine';

/** A Drive folder in memory. */
function fakeDrive() {
  const files = new Map<string, { pieceId: string; updatedAt: number; json: string }>();
  let n = 0;
  const drive: Drive = {
    async list() {
      return [...files].map(([id, f]): RemoteFile => ({ id, pieceId: f.pieceId, updatedAt: f.updatedAt }));
    },
    async download(id) {
      const f = files.get(id);
      if (!f) throw new DriveError(404);
      return f.json;
    },
    async upload(pieceId, updatedAt, json, fileId) {
      if (fileId && !files.has(fileId)) throw new DriveError(404);
      const id = fileId ?? `f${++n}`;
      files.set(id, { pieceId, updatedAt, json });
      return id;
    },
    async remove(id) {
      files.delete(id);
    },
  };
  return { drive, files };
}

/** One device: a library plus the sync state. */
function device(drive: Drive) {
  const lib = new Map<string, Piece>();
  const state = { files: {} as Record<string, { fileId: string; syncedAt: number }>, deleted: [] as string[] };
  const deps = (): SyncDeps => ({
    drive,
    pieces: [...lib.values()],
    state,
    storeSynced: (p) => void lib.set(p.id, p),
    removeSynced: (id) => void lib.delete(id),
    addCopy: (p) => {
      const copy = { ...JSON.parse(JSON.stringify(p)), id: `copy-${p.id}-${lib.size}`, updatedAt: Date.now() } as Piece;
      copy.meta.title += ' (conflict)';
      lib.set(copy.id, copy);
      return copy;
    },
    parse: (text) => normalizePiece(JSON.parse(text)),
  });
  return {
    lib, state,
    sync: () => runSync(deps()),
    edit(id: string, title: string, at: number) {
      const p = lib.get(id)!;
      lib.set(id, { ...p, meta: { ...p.meta, title }, updatedAt: at });
    },
    remove(id: string) {
      const known = state.files[id];
      if (known) state.deleted.push(known.fileId);
      delete state.files[id];
      lib.delete(id);
    },
  };
}

const piece = (id: string, title: string, at: number): Piece => {
  const p = createPiece();
  // a fixed creation time, so two pieces built a millisecond apart are still equal
  return { ...p, id, createdAt: 1, updatedAt: at, meta: { ...p.meta, title } };
};

describe('sync', () => {
  it('uploads new pieces and fetches them on another device', async () => {
    const { drive, files } = fakeDrive();
    const a = device(drive);
    const b = device(drive);
    a.lib.set('p1', piece('p1', 'One', 100));
    expect(await a.sync()).toMatchObject({ uploaded: 1, downloaded: 0 });
    expect(files.size).toBe(1);
    expect(await b.sync()).toMatchObject({ downloaded: 1 });
    expect(b.lib.get('p1')?.meta.title).toBe('One');
    expect(b.lib.get('p1')?.updatedAt).toBe(100);
    // nothing to do the second time
    expect(await b.sync()).toMatchObject({ uploaded: 0, downloaded: 0, conflicts: 0 });
    expect(await a.sync()).toMatchObject({ uploaded: 0, downloaded: 0 });
  });

  it('carries an edit from one device to the other', async () => {
    const { drive } = fakeDrive();
    const a = device(drive);
    const b = device(drive);
    a.lib.set('p1', piece('p1', 'One', 100));
    await a.sync();
    await b.sync();
    b.edit('p1', 'One, revised', 200);
    expect(await b.sync()).toMatchObject({ uploaded: 1 });
    expect(await a.sync()).toMatchObject({ downloaded: 1 });
    expect(a.lib.get('p1')?.meta.title).toBe('One, revised');
  });

  it('keeps both versions when a piece changed on both sides; the newer wins', async () => {
    const { drive } = fakeDrive();
    const a = device(drive);
    const b = device(drive);
    a.lib.set('p1', piece('p1', 'One', 100));
    await a.sync();
    await b.sync();
    a.edit('p1', 'From A', 300);
    b.edit('p1', 'From B', 200);
    await a.sync(); // A uploads first
    const report = await b.sync();
    expect(report.conflicts).toBe(1);
    expect(b.lib.get('p1')?.meta.title).toBe('From A');
    expect([...b.lib.values()].map((p) => p.meta.title).sort()).toEqual(['From A', 'From B (conflict)']);
    await b.sync();
    await a.sync();
    expect([...a.lib.values()].map((p) => p.meta.title).sort()).toEqual(['From A', 'From B (conflict)']);
  });

  it('passes deletions on, but not for a piece edited since', async () => {
    const { drive, files } = fakeDrive();
    const a = device(drive);
    const b = device(drive);
    a.lib.set('p1', piece('p1', 'One', 100));
    a.lib.set('p2', piece('p2', 'Two', 100));
    await a.sync();
    await b.sync();
    a.remove('p1');
    b.edit('p2', 'Two, edited', 150);
    await a.sync();
    expect(files.size).toBe(1);
    const rb = await b.sync();
    expect(rb.deletedHere).toBe(1);
    expect(b.lib.has('p1')).toBe(false);
    // p2 is removed on A while B edits it again (not synced yet): B keeps it and uploads it anew
    b.edit('p2', 'Two, edited again', 400);
    a.remove('p2');
    await a.sync();
    await b.sync();
    expect(b.lib.get('p2')?.meta.title).toBe('Two, edited again');
    expect(files.size).toBe(1);
  });

  it('does not duplicate when both devices start with the same piece', async () => {
    const { drive, files } = fakeDrive();
    const a = device(drive);
    const b = device(drive);
    a.lib.set('p1', piece('p1', 'One', 100));
    b.lib.set('p1', piece('p1', 'One', 100));
    await a.sync();
    const r = await b.sync();
    expect(r.conflicts).toBe(0);
    expect(files.size).toBe(1);
    expect(b.lib.size).toBe(1);
  });

  it('removes duplicate files of one piece, keeping the newest', async () => {
    const { drive, files } = fakeDrive();
    files.set('x', { pieceId: 'p1', updatedAt: 100, json: JSON.stringify(piece('p1', 'Old', 100)) });
    files.set('y', { pieceId: 'p1', updatedAt: 200, json: JSON.stringify(piece('p1', 'New', 200)) });
    const a = device(drive);
    await a.sync();
    expect([...files.keys()]).toEqual(['y']);
    expect(a.lib.get('p1')?.meta.title).toBe('New');
  });

  it('stops on sign-in errors', async () => {
    const { drive } = fakeDrive();
    drive.list = async () => {
      throw new DriveError(401);
    };
    await expect(device(drive).sync()).rejects.toMatchObject({ status: 401 });
  });
});

describe('Drive client', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it('lists the app folder page by page with the token', async () => {
    const seen: { url: string; auth: string | null }[] = [];
    const pages = [
      json({ nextPageToken: 'n', files: [{ id: '1', appProperties: { pieceId: 'a', updatedAt: '5' } }] }),
      json({ files: [{ id: '2', appProperties: { pieceId: 'b', updatedAt: '7' } }, { id: '3' }] }),
    ];
    const drive = createDrive(() => 'tok', (async (url: string, init?: RequestInit) => {
      seen.push({ url, auth: new Headers(init?.headers).get('Authorization') });
      return pages.shift()!;
    }) as typeof fetch);
    expect(await drive.list()).toEqual([{ id: '1', pieceId: 'a', updatedAt: 5 }, { id: '2', pieceId: 'b', updatedAt: 7 }]);
    expect(seen[0].url).toContain('spaces=appDataFolder');
    expect(seen[1].url).toContain('pageToken=n');
    expect(seen.every((s) => s.auth === 'Bearer tok')).toBe(true);
  });

  it('uploads as multipart into the app folder, and replaces in place', async () => {
    const calls: { url: string; method?: string; body: string }[] = [];
    const drive = createDrive(() => 't', (async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method, body: String(init?.body) });
      return json({ id: 'F' });
    }) as typeof fetch);
    expect(await drive.upload('p1', 42, '{"a":1}')).toBe('F');
    expect(calls[0].method).toBe('POST');
    expect(calls[0].body).toContain('"parents":["appDataFolder"]');
    expect(calls[0].body).toContain('"updatedAt":"42"');
    expect(calls[0].body).toContain('{"a":1}');
    await drive.upload('p1', 43, '{}', 'F');
    expect(calls[1].method).toBe('PATCH');
    expect(calls[1].url).toContain('/F?uploadType=multipart');
    expect(calls[1].body).not.toContain('parents');
  });

  it('reports HTTP and network failures', async () => {
    const bad = createDrive(() => 't', (async () => json({ error: { message: 'API off' } }, 403)) as typeof fetch);
    await expect(bad.list()).rejects.toMatchObject({ status: 403, message: 'API off' });
    const offline = createDrive(() => 't', (async () => {
      throw new TypeError('x');
    }) as typeof fetch);
    await expect(offline.list()).rejects.toMatchObject({ status: 0 });
  });
});
