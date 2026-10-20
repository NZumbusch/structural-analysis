import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createExample } from '../domain/example';
import { crc32, zip } from './zip';
import { codeFromHash, decodePiece, encodePiece } from './share';

describe('zip', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it('writes archives that unzip accepts', () => {
    const data = zip([
      { name: 'a.svg', data: new TextEncoder().encode('<svg/>') },
      { name: 'ü/b.png', data: new Uint8Array([1, 2, 3, 4]) },
    ]);
    const dir = mkdtempSync(join(tmpdir(), 'zip-'));
    const file = join(dir, 't.zip');
    writeFileSync(file, data);
    let out = '';
    try {
      out = execFileSync('unzip', ['-t', file], { encoding: 'utf8' });
    } catch (e) {
      // unzip not installed: fall back to python
      out = execFileSync('python3', ['-c', `import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print(z.testzip() or 'No errors', z.namelist())`, file], { encoding: 'utf8' });
    }
    expect(out).toMatch(/No errors/);
  });
});

describe('share link', () => {
  it('round-trips a piece and stays short', async () => {
    const piece = createExample();
    const code = await encodePiece(piece);
    expect(code.length).toBeLessThan(2500);
    const back = await decodePiece(code);
    expect(back?.segments).toHaveLength(piece.segments.length);
    expect(back?.meta.title).toBe(piece.meta.title);
    expect(back?.passing[0].pos).toBe(74.5);
    expect(back?.id).not.toBe(piece.id);
    expect(codeFromHash(`#p=${code}`)).toBe(code);
  });
  it('rejects garbage', async () => {
    expect(await decodePiece('not-valid')).toBeNull();
    expect(codeFromHash('#other')).toBeNull();
  });
});
