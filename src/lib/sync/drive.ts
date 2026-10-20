/** The few Google Drive calls the sync needs, all against the app's own hidden folder (`appDataFolder`). */
export interface RemoteFile {
  id: string;
  pieceId: string;
  /** The piece's `updatedAt` as it was uploaded. */
  updatedAt: number;
}

export interface Drive {
  list(): Promise<RemoteFile[]>;
  download(fileId: string): Promise<string>;
  /** Creates the file, or replaces its contents when `fileId` is given. Returns the file id. */
  upload(pieceId: string, updatedAt: number, json: string, fileId?: string): Promise<string>;
  remove(fileId: string): Promise<void>;
}

export class DriveError extends Error {
  constructor(
    public status: number,
    message = `Drive ${status}`,
  ) {
    super(message);
  }
}

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

export function createDrive(getToken: () => string, doFetch: typeof fetch = (...a) => fetch(...a)): Drive {
  async function call(url: string, init: RequestInit = {}): Promise<Response> {
    let res: Response;
    try {
      res = await doFetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${getToken()}` } });
    } catch {
      throw new DriveError(0, 'network');
    }
    if (!res.ok && res.status !== 404) {
      let detail = '';
      try {
        detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? '';
      } catch {
        /* no body */
      }
      throw new DriveError(res.status, detail || `Drive ${res.status}`);
    }
    return res;
  }

  return {
    async list() {
      const out: RemoteFile[] = [];
      let page = '';
      do {
        const q = new URLSearchParams({
          spaces: 'appDataFolder',
          pageSize: '1000',
          fields: 'nextPageToken,files(id,appProperties)',
          ...(page ? { pageToken: page } : {}),
        });
        const body = (await (await call(`${API}?${q}`)).json()) as {
          nextPageToken?: string;
          files?: { id: string; appProperties?: { pieceId?: string; updatedAt?: string } }[];
        };
        for (const f of body.files ?? []) {
          const pieceId = f.appProperties?.pieceId;
          if (pieceId) out.push({ id: f.id, pieceId, updatedAt: Number(f.appProperties?.updatedAt) || 0 });
        }
        page = body.nextPageToken ?? '';
      } while (page);
      return out;
    },

    async download(fileId) {
      const res = await call(`${API}/${encodeURIComponent(fileId)}?alt=media`);
      if (res.status === 404) throw new DriveError(404);
      return res.text();
    },

    async upload(pieceId, updatedAt, json, fileId) {
      const boundary = 'tv' + Math.random().toString(36).slice(2);
      const meta = {
        name: `piece-${pieceId}.json`,
        appProperties: { pieceId, updatedAt: String(updatedAt) },
        ...(fileId ? {} : { parents: ['appDataFolder'] }),
      };
      const body =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${json}\r\n--${boundary}--`;
      const url = fileId ? `${UPLOAD}/${encodeURIComponent(fileId)}?uploadType=multipart&fields=id` : `${UPLOAD}?uploadType=multipart&fields=id`;
      const res = await call(url, { method: fileId ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
      if (res.status === 404) throw new DriveError(404);
      return ((await res.json()) as { id: string }).id;
    },

    async remove(fileId) {
      await call(`${API}/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
    },
  };
}
