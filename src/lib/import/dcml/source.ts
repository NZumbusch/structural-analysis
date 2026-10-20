import type { DcmlInput } from './convert';
import { columnsOf, parseTsv, type Row } from './tsv';

/** Returns the text of a file, or null if it does not exist. Throws when the network fails. */
export type Fetcher = (url: string) => Promise<string | null>;

export interface RepoRef {
  owner: string;
  repo: string;
  /** Branch, tag or commit. */
  ref: string;
}

export const browserFetcher: Fetcher = async (url) => {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status}`);
  const text = await res.text();
  // an offline fallback page is not a table
  return /^\s*</.test(text) ? null : text;
};

/**
 * Accepts 'https://github.com/DCMLab/mozart_piano_sonatas', a link to a branch, tag or commit
 * ('…/tree/ad4a9dfa…'), a link to a file in the repository, 'DCMLab/ABC' or 'DCMLab/ABC@v2.0'.
 */
export function parseRepoRef(input: string): RepoRef | null {
  const s = input.trim().replace(/\.git$/, '').replace(/\/+$/, '');
  let m = s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)(?:\/(?:tree|blob)\/([^/\s]+))?/i);
  if (m) return { owner: m[1], repo: m[2], ref: m[3] ?? 'main' };
  m = s.match(/^(?:https?:\/\/)?raw\.githubusercontent\.com\/([\w.-]+)\/([\w.-]+)\/([^/\s]+)/i);
  if (m) return { owner: m[1], repo: m[2], ref: m[3] };
  m = s.match(/^([\w.-]+)\/([\w.-]+?)(?:@([^\s]+))?$/);
  if (m) return { owner: m[1], repo: m[2], ref: m[3] ?? 'main' };
  return null;
}

export const rawUrl = (r: RepoRef, path: string) => `https://raw.githubusercontent.com/${r.owner}/${r.repo}/${r.ref}/${path}`;
export const repoUrl = (r: RepoRef) => `https://github.com/${r.owner}/${r.repo}/tree/${r.ref}`;

export interface Corpus {
  owner: string;
  repo: string;
}

/** The corpora listed in the collection repository (its git submodules). */
export async function listCorpora(fetcher: Fetcher = browserFetcher): Promise<Corpus[]> {
  const text = await fetcher('https://raw.githubusercontent.com/DCMLab/dcml_corpora/main/.gitmodules');
  if (!text) return [];
  const out: Corpus[] = [];
  for (const m of text.matchAll(/url\s*=\s*\S*github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?\s*$/gm)) {
    if (!out.some((c) => c.owner === m[1] && c.repo === m[2])) out.push({ owner: m[1], repo: m[2] });
  }
  return out.sort((a, b) => a.repo.localeCompare(b.repo));
}

export interface PieceEntry {
  piece: string;
  title: string;
  composer: string;
  key: string;
  bars: string;
  labels: number;
  row: Row;
}

export function entryOf(row: Row): PieceEntry {
  const movement = [row.movementNumber, row.movementTitle].filter(Boolean).join('. ');
  const title = [row.workTitle || row.title_text, movement].filter(Boolean).join(' – ');
  return {
    piece: row.piece,
    title,
    composer: row.composer || row.composer_text || '',
    key: row.annotated_key ?? '',
    bars: row.last_mn ?? '',
    labels: Number(row.label_count) || 0,
    row,
  };
}

/** The pieces of a corpus, from its `metadata.tsv`. */
export async function listPieces(repo: RepoRef, fetcher: Fetcher = browserFetcher): Promise<PieceEntry[]> {
  const text = await fetcher(rawUrl(repo, 'metadata.tsv'));
  if (!text) return [];
  const seen = new Set<string>();
  return parseTsv(text)
    .filter((r) => r.piece && !seen.has(r.piece) && seen.add(r.piece))
    .map(entryOf);
}

async function firstFound(fetcher: Fetcher, urls: string[]): Promise<string | null> {
  for (const url of urls) {
    const text = await fetcher(url);
    if (text !== null) return text;
  }
  return null;
}

export async function loadPiece(repo: RepoRef, entry: PieceEntry, fetcher: Fetcher = browserFetcher): Promise<DcmlInput> {
  const p = entry.piece;
  const [harmonies, measures] = await Promise.all([
    firstFound(fetcher, [rawUrl(repo, `harmonies/${p}.harmonies.tsv`), rawUrl(repo, `harmonies/${p}.tsv`)]),
    firstFound(fetcher, [rawUrl(repo, `measures/${p}.measures.tsv`), rawUrl(repo, `measures/${p}.tsv`)]),
  ]);
  if (harmonies === null) throw new Error('missing-harmonies');
  return { piece: p, harmonies, measures: measures ?? undefined, metadata: entry.row, source: { repo: repo.repo, ref: repo.ref, url: repoUrl(repo) } };
}

// ---- files chosen from the device ------------------------------------------------------------------------------

export interface PickedFile {
  name: string;
  text: string;
}

/** Sorts chosen .tsv files into pieces: harmonies and measures tables of the same name belong together. */
export function groupFiles(files: PickedFile[]): { inputs: DcmlInput[]; ignored: string[] } {
  const meta = new Map<string, Row>();
  const parts = new Map<string, { harmonies?: string; measures?: string }>();
  const ignored: string[] = [];
  for (const f of files) {
    const cols = columnsOf(f.text);
    const stem = f.name.replace(/\.(harmonies|measures)?\.?tsv$/i, '').replace(/\.tsv$/i, '');
    if (cols.includes('piece') && cols.includes('last_mc')) {
      for (const r of parseTsv(f.text)) if (r.piece) meta.set(r.piece, r);
    } else if (cols.includes('localkey') && cols.includes('mc')) {
      parts.set(stem, { ...parts.get(stem), harmonies: f.text });
    } else if (cols.includes('act_dur') && cols.includes('mc')) {
      parts.set(stem, { ...parts.get(stem), measures: f.text });
    } else ignored.push(f.name);
  }
  const inputs: DcmlInput[] = [];
  for (const [piece, p] of parts) {
    if (p.harmonies === undefined) {
      ignored.push(`${piece} (measures)`);
      continue;
    }
    inputs.push({ piece, harmonies: p.harmonies, measures: p.measures, metadata: meta.get(piece) ?? null });
  }
  return { inputs, ignored };
}
