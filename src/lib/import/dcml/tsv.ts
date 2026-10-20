/** Minimal reader for the tab-separated tables of the DCML corpora. */
export type Row = Record<string, string>;

/**
 * Splits text into records of cells. A cell that starts with a quotation mark may contain tabs and line breaks
 * (the metadata tables have such cells) and ends at the next single quotation mark; "" stands for one.
 */
function records(text: string, first = false): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let i = text.startsWith('\uFEFF') ? 1 : 0;
  const n = text.length;
  while (i <= n) {
    let cell = '';
    if (text[i] === '"') {
      i++;
      for (; i < n; i++) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            cell += '"';
            i++;
          } else break;
        } else cell += text[i];
      }
      i++; // closing quote
      while (i < n && text[i] !== '\t' && text[i] !== '\n' && text[i] !== '\r') cell += text[i++];
    } else {
      const start = i;
      while (i < n && text[i] !== '\t' && text[i] !== '\n' && text[i] !== '\r') i++;
      cell = text.slice(start, i);
    }
    row.push(cell.trim());
    if (i >= n || text[i] === '\n' || text[i] === '\r') {
      if (text[i] === '\r' && text[i + 1] === '\n') i++;
      if (row.length > 1 || row[0] !== '') out.push(row);
      row = [];
      if (first && out.length > 0) return out;
      if (i >= n) break;
    }
    i++;
  }
  return out;
}

export function parseTsv(text: string): Row[] {
  const [head, ...body] = records(text);
  if (!head) return [];
  return body.map((cells) => {
    const row: Row = {};
    head.forEach((h, i) => (row[h] = cells[i] ?? ''));
    return row;
  });
}

export function columnsOf(text: string): string[] {
  return records(text, true)[0] ?? [];
}

/** '3/4' -> 0.75, '4.0' -> 4, '' -> NaN. Positions in the tables are fractions of a whole note. */
export function frac(text: string | undefined): number {
  if (text === undefined) return NaN;
  const s = text.trim();
  if (s === '') return NaN;
  const m = s.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  return Number(s);
}
