import type { Lang } from '../domain/types';

export interface Column<T> {
  key: string;
  label: string;
  /** Raw value used for sorting. */
  value: (row: T) => string | number;
  /** What is shown and exported; defaults to the raw value. */
  text?: (row: T) => string;
  align?: 'left' | 'right';
  /** A bar position; `value` is the decimal bar number (42.5 = bar 42, beat 3 in 4/4). */
  position?: boolean;
}

export function formatNumber(n: number, lang: Lang, digits = 2): string {
  const rounded = Math.round(n * 10 ** digits) / 10 ** digits;
  const text = String(rounded);
  return lang === 'de' ? text.replace('.', ',') : text;
}

export function formatPercent(share: number, lang: Lang): string {
  return `${formatNumber(share * 100, lang, 1)} %`;
}

function cell(text: string, sep: string): string {
  return text.includes(sep) || /["\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Excel in German locales expects ';' and decimal commas, so exports follow the UI language. */
export function toCsv<T>(columns: Column<T>[], rows: T[], lang: Lang): string {
  const sep = lang === 'de' ? ';' : ',';
  const suffix = lang === 'de' ? 'dezimal' : 'decimal';
  // Positions like "42:3" are read as a time by spreadsheets, so a column with beats gets a plain decimal twin.
  const withTwins = columns.flatMap((c) => {
    if (!c.position || !c.text || rows.every((r) => c.text!(r) === String(c.value(r)))) return [c];
    const twin: Column<T> = { key: `${c.key}-decimal`, label: `${c.label} (${suffix})`, value: c.value, text: (r) => formatNumber(Number(c.value(r)), lang, 4) };
    return [c, twin];
  });
  const head = withTwins.map((c) => cell(c.label, sep)).join(sep);
  const body = rows.map((r) => withTwins.map((c) => cell(c.text ? c.text(r) : String(c.value(r)), sep)).join(sep));
  return '﻿' + [head, ...body].join('\r\n') + '\r\n';
}

/** Tab separated, for pasting into Word or a spreadsheet. */
export function toTsv<T>(columns: Column<T>[], rows: T[]): string {
  const clean = (s: string) => s.replace(/[\t\r\n]+/g, ' ');
  return [columns.map((c) => clean(c.label)).join('\t'), ...rows.map((r) => columns.map((c) => clean(c.text ? c.text(r) : String(c.value(r)))).join('\t'))].join('\n');
}
