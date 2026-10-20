import { sameKey } from '../../domain/keys';
import { newId } from '../../domain/ids';
import { cloneStyle, createPiece, DEFAULT_STYLE } from '../../domain/piece';
import { makeEvent } from '../../domain/structure';
import type { Key, Lang, Piece, Segment, SegmentKind, StructEvent, Style } from '../../domain/types';
import { frac, parseTsv, type Row } from './tsv';
import { keyAbove, keyOfRelativeRoot, parseGlobalKey } from './numeral';

/** Which of the details found in the tables end up in the piece. The key path itself is always imported. */
export interface DcmlOptions {
  /** Repeat signs and numbered endings. */
  repeats: boolean;
  /** Time signature changes (the first time signature is always taken). */
  meters: boolean;
  /** Key signature changes. */
  keysigs: boolean;
  /** Double and final bar lines. */
  barlines: boolean;
  /** Applied chords (V7/IV …) as dashed tonicisations. */
  tonicizations: boolean;
  /** Cadence labels (PAC, HC …) as markers. */
  cadences: boolean;
  /** Source, annotators and a licence note in the piece's metadata. */
  attribution: boolean;
}

export const DEFAULT_DCML_OPTIONS: DcmlOptions = {
  repeats: true,
  meters: true,
  keysigs: true,
  barlines: true,
  tonicizations: false,
  cadences: false,
  attribution: true,
};

export interface DcmlSource {
  repo?: string;
  ref?: string;
  url?: string;
}

export interface DcmlInput {
  /** Name of the piece in the corpus, e.g. 'K279-1'. */
  piece: string;
  /** Contents of `harmonies/<piece>.harmonies.tsv`. */
  harmonies: string;
  /** Contents of `measures/<piece>.measures.tsv`; without it every measure counts as one bar and nothing about repeats is known. */
  measures?: string;
  /** The piece's row from `metadata.tsv`. */
  metadata?: Row | null;
  source?: DcmlSource;
}

export type WarningCode = 'no-harmonies' | 'no-measures' | 'bad-localkey' | 'unknown-bar' | 'mid-pickup' | 'volta-numbering' | 'no-next';
export interface DcmlWarning {
  code: WarningCode;
  arg?: string;
}

export interface DcmlCounts {
  bars: number;
  keys: number;
  tonicizations: number;
  repeats: number;
  endings: number;
  meters: number;
  keysigs: number;
  barlines: number;
  cadences: number;
}

export interface DcmlResult {
  piece: Piece;
  warnings: DcmlWarning[];
  counts: DcmlCounts;
}

const EPS = 1e-9;
const round = (n: number) => Math.round(n * 1e6) / 1e6;

interface Bar {
  mc: number;
  /** Whole bar number in the chart (the anacrusis is bar 0). Both halves of a split bar share one. */
  base: number;
  /** Where in the nominal bar this measure begins, in whole notes (0 unless it is a pickup or the second half of a split bar). */
  offset: number;
  /** Length actually written, in whole notes. */
  act: number;
  /** Length of a full bar in this time signature, in whole notes. */
  nominal: number;
  beats: number;
  unit: number;
  keysig: number | null;
  barline: string;
  volta: number[];
  next: number[] | null;
  start: number;
  end: number;
  continuation: boolean;
}

function parseMeter(text: string | undefined, fallback: { beats: number; unit: number }) {
  const m = (text ?? '').match(/^(\d+)\s*\/\s*(\d+)$/);
  return m ? { beats: Number(m[1]), unit: Number(m[2]) } : fallback;
}

const ints = (text: string | undefined): number[] => (text ?? '').match(/-?\d+/g)?.map(Number) ?? [];

function buildBars(measures: Row[] | null, harmonies: Row[], warnings: DcmlWarning[]): Bar[] {
  let rows = measures;
  if (!rows) {
    // Without a measure table: one bar per measure count mentioned in the labels, time signature from the labels.
    const last = Math.max(1, ...harmonies.map((h) => Number(h.mc) || 0));
    const sigOf = new Map<number, string>();
    for (const h of harmonies) if (h.timesig) sigOf.set(Number(h.mc), h.timesig);
    let sig = harmonies.find((h) => h.timesig)?.timesig ?? '4/4';
    rows = [];
    for (let mc = 1; mc <= last; mc++) {
      sig = sigOf.get(mc) ?? sig;
      rows.push({ mc: String(mc), timesig: sig });
    }
    warnings.push({ code: 'no-measures' });
  }

  const bars: Bar[] = [];
  let meter = { beats: 4, unit: 4 };
  let base = 1;
  let midPickup = false;
  for (const r of rows) {
    const mc = Number(r.mc);
    if (!Number.isFinite(mc)) continue;
    meter = parseMeter(r.timesig, meter);
    const nominal = meter.beats / meter.unit;
    const act = Number.isFinite(frac(r.act_dur)) ? frac(r.act_dur) : nominal;
    const given = Number.isFinite(frac(r.mc_offset)) ? frac(r.mc_offset) : 0;
    const prev = bars[bars.length - 1];
    let offset = given;
    let continuation = false;
    if (!prev) {
      if (act < nominal - EPS) {
        base = 0;
        offset = given > EPS ? given : nominal - act;
      }
    } else if (given > EPS && Math.abs(prev.offset + prev.act - given) < 1e-6) {
      continuation = true;
      base = prev.base;
    } else {
      base = prev.base + 1;
      if (given > EPS) midPickup = true;
    }
    const start = base + offset / nominal;
    bars.push({
      mc, base, offset, act, nominal, beats: meter.beats, unit: meter.unit,
      keysig: r.keysig !== undefined && r.keysig !== '' ? Number(r.keysig) : null,
      barline: r.barline ?? '',
      volta: ints(r.volta),
      next: r.next !== undefined && r.next !== '' ? ints(r.next) : null,
      start: round(start),
      end: round(base + (offset + act) / nominal),
      continuation,
    });
  }
  // An incomplete measure that is not completed by the next one (a short ending, the last bar after a pickup) fills its bar.
  bars.forEach((b, i) => {
    if (!bars[i + 1]?.continuation) b.end = Math.ceil(b.end - 1e-6);
  });
  if (midPickup) warnings.push({ code: 'mid-pickup' });
  return bars;
}

interface Label {
  pos: number;
  key: Key;
  local: Key;
  relativeRoot: string;
  numeral: string;
  cadence: string;
}

const kindOfApplied = (numeral: string): SegmentKind => {
  const plain = numeral.replace(/^[#b♯♭]+/, '');
  return plain === 'V' || plain === 'vii' ? 'dominant' : 'tonicization';
};

function merge(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const s of segments) {
    const last = out[out.length - 1];
    if (last && last.kind === s.kind && sameKey(last.key, s.key) && Math.abs(last.to - s.from) < EPS) last.to = s.to;
    else out.push({ ...s });
  }
  return out;
}

/** Puts `over` on top of `segments`, cutting the stretch it covers out of whatever was there. */
function overlay(segments: Segment[], over: Segment[]): Segment[] {
  let current = segments;
  for (const o of over) {
    const next: Segment[] = [];
    for (const s of current) {
      if (s.to <= o.from + EPS || s.from >= o.to - EPS) {
        next.push(s);
        continue;
      }
      if (s.from < o.from - EPS) next.push({ ...s, id: newId(), to: o.from });
      if (s.to > o.to + EPS) next.push({ ...s, id: newId(), from: o.to });
    }
    next.push(o);
    current = next.sort((a, b) => a.from - b.from);
  }
  return merge(current);
}

export function convertDcml(input: DcmlInput, options: DcmlOptions = DEFAULT_DCML_OPTIONS, lang: Lang = 'de', style: Style = DEFAULT_STYLE): DcmlResult {
  const warnings: DcmlWarning[] = [];
  const harmonyRows = parseTsv(input.harmonies).filter((r) => r.mc !== undefined && r.mc !== '' && Number.isFinite(Number(r.mc)));
  const measureRows = input.measures ? parseTsv(input.measures) : null;
  if (harmonyRows.length === 0) warnings.push({ code: 'no-harmonies' });

  const bars = buildBars(measureRows, harmonyRows, warnings);
  const byMc = new Map(bars.map((b) => [b.mc, b]));
  const firstBar = bars[0];
  const lastBar = bars[bars.length - 1];
  const pieceStart = firstBar ? firstBar.start : 1;
  const pieceEnd = lastBar ? lastBar.end : 1;

  // ---- labels: where the key is --------------------------------------------------------------------
  const unknown = new Set<string>();
  const labels: Label[] = [];
  let globalKey: Key | null = null;
  let local: Key | null = null;
  const missingBars = new Set<number>();
  harmonyRows.forEach((r) => {
    const bar = byMc.get(Number(r.mc));
    if (!bar) {
      missingBars.add(Number(r.mc));
      return;
    }
    if (r.globalkey) globalKey = parseGlobalKey(r.globalkey) ?? globalKey;
    if (!globalKey) return;
    if (r.localkey) {
      const k = keyAbove(globalKey, r.localkey);
      if (k) local = k;
      else unknown.add(r.localkey);
    }
    local = local ?? { fifths: globalKey.fifths, mode: globalKey.mode };
    const onset = Number.isFinite(frac(r.mc_onset)) ? frac(r.mc_onset) : 0;
    labels.push({
      pos: round(bar.base + (bar.offset + onset) / bar.nominal),
      key: local,
      local,
      relativeRoot: r.relativeroot ?? '',
      numeral: r.numeral ?? '',
      cadence: r.cadence ?? '',
    });
  });
  for (const value of unknown) warnings.push({ code: 'bad-localkey', arg: value });
  if (missingBars.size > 0) warnings.push({ code: 'unknown-bar', arg: [...missingBars].slice(0, 5).join(', ') });
  labels.sort((a, b) => a.pos - b.pos);

  // ---- key path --------------------------------------------------------------------------------------------
  const bounds: { pos: number; key: Key }[] = [];
  for (const l of labels) {
    const last = bounds[bounds.length - 1];
    if (last && sameKey(last.key, l.key)) continue;
    if (last && Math.abs(last.pos - l.pos) < EPS) last.key = l.key;
    else bounds.push({ pos: l.pos, key: l.key });
  }
  if (bounds.length > 0) bounds[0].pos = Math.min(bounds[0].pos, pieceStart);
  const segmentsOf = (): Segment[] =>
    bounds
      .map((b, i): Segment => ({ id: newId(), from: b.pos, to: bounds[i + 1]?.pos ?? pieceEnd, key: b.key, kind: 'key', label: '' }))
      .filter((s) => s.to - s.from > 1e-6);
  let segments = merge(segmentsOf());
  const keyCount = segments.length;

  // ---- applied chords as tonicisations (optional) ---------------------------------------------------------------------
  let tonicizations = 0;
  if (options.tonicizations) {
    const over: Segment[] = [];
    labels.forEach((l, i) => {
      if (!l.relativeRoot) return;
      const target = keyOfRelativeRoot(l.local, l.relativeRoot);
      if (!target) return;
      const next = labels.slice(i + 1).find((n) => n.pos > l.pos + EPS);
      const to = next ? next.pos : pieceEnd;
      if (to - l.pos < 1e-6) return;
      over.push({ id: newId(), from: l.pos, to, key: target, kind: kindOfApplied(l.numeral), label: '' });
    });
    const merged = merge(over);
    tonicizations = merged.length;
    segments = overlay(segments, merged);
  }

  // ---- structure -------------------------------------------------------------------------------------------------------------
  const events: StructEvent[] = [];
  const counts: DcmlCounts = { bars: 0, keys: keyCount, tonicizations, repeats: 0, endings: 0, meters: 0, keysigs: 0, barlines: 0, cadences: 0 };
  counts.bars = new Set(bars.map((b) => b.base)).size;

  if (options.repeats) {
    const hasNext = bars.some((b) => b.next !== null);
    const starts = new Set<number>();
    const addRepeat = (from: Bar | undefined, endPos: number) => {
      if (from && !starts.has(from.start)) {
        starts.add(from.start);
        events.push(makeEvent('repeat-start', from.start));
      }
      events.push(makeEvent('repeat-end', endPos, { times: 2 }));
      counts.repeats += 1;
    };
    if (hasNext) {
      for (const b of bars) for (const t of b.next ?? []) if (t >= 1 && t <= b.mc) addRepeat(byMc.get(t), b.end);
    } else if (bars.length > 0) {
      warnings.push({ code: 'no-next' });
      let open: Bar | undefined = bars[0];
      for (const b of bars) {
        if (b.barline.includes('start-repeat')) open = b;
        if (b.barline.includes('end-repeat')) {
          addRepeat(open, b.end);
          open = bars[0];
        }
      }
    }
    // numbered endings: consecutive measures carrying the same ending number
    let run: Bar[] = [];
    const flush = () => {
      if (run.length === 0) return;
      events.push(makeEvent('volta', run[0].start, { to: run[run.length - 1].end, numbers: run[0].volta }));
      counts.endings += 1;
      run = [];
    };
    for (const b of bars) {
      if (b.volta.length > 0 && run.length > 0 && run[0].volta.join() === b.volta.join()) run.push(b);
      else {
        flush();
        if (b.volta.length > 0) run = [b];
      }
    }
    flush();
    if (counts.endings > 0) warnings.push({ code: 'volta-numbering' });
  }

  if (options.meters || options.keysigs || options.barlines) {
    bars.forEach((b, i) => {
      const prev = bars[i - 1];
      if (options.meters && prev && !b.continuation && (prev.beats !== b.beats || prev.unit !== b.unit)) {
        events.push(makeEvent('meter', b.start, { beats: b.beats, unit: b.unit }));
        counts.meters += 1;
      }
      if (options.keysigs && prev && b.keysig !== null && prev.keysig !== null && b.keysig !== prev.keysig) {
        events.push(makeEvent('keysig', b.start, { fifths: b.keysig }));
        counts.keysigs += 1;
      }
      if (options.barlines) {
        const style = /^(double|light-light)$/.test(b.barline) ? 'double' : /^(end|light-heavy|final)$/.test(b.barline) ? 'final' : null;
        if (style) {
          events.push(makeEvent('barline', b.end, { style }));
          counts.barlines += 1;
        }
      }
    });
  }

  if (options.cadences) {
    for (const l of labels) {
      if (!l.cadence) continue;
      events.push(makeEvent('marker', l.pos, { label: l.cadence, line: false }));
      counts.cadences += 1;
    }
  }

  // ---- the piece -------------------------------------------------------------------------------------------------------------------------
  const out = createPiece({}, cloneStyle(style));
  const md = input.metadata ?? {};
  const pick = (...names: string[]) => names.map((n) => (md[n] ?? '').trim()).find((v) => v !== '') ?? '';
  const first = labels.length > 0 ? firstGlobal(harmonyRows) : null;
  const movementNo = pick('movementNumber');
  const movementTitle = pick('movementTitle');
  const movement = movementNo && movementTitle ? `${movementNo}. ${movementTitle}` : movementTitle || movementNo;
  const pickup = firstBar && firstBar.base === 0 ? round(firstBar.act * firstBar.unit) : 0;
  out.meta = {
    ...out.meta,
    title: pick('workTitle', 'title_text') || input.piece,
    composer: pick('composer', 'composer_text'),
    year: pick('composed_end', 'composed_start'),
    catalog: pick('workNumber'),
    movement,
    center: first ?? out.meta.center,
    meter: firstBar ? { beats: firstBar.beats, unit: firstBar.unit } : out.meta.meter,
    pickup,
    lastBar: Math.max(1, Math.ceil(pieceEnd - 1e-6) - 1),
  };
  out.segments = segments;
  out.events = events;

  if (options.attribution) {
    const src = input.source;
    const where = [src?.repo ? `DCML ${src.repo}` : 'DCML', src?.ref && /^[0-9a-f]{40}$/.test(src.ref) ? src.ref.slice(0, 7) : src?.ref, input.piece].filter(Boolean).join(' ');
    out.meta.source = src?.url ? `${where} (${src.url})` : where;
    const annotators = pick('annotators');
    const reviewers = pick('reviewers');
    const people = [annotators && `Annotation: ${annotators}`, reviewers && `Review: ${reviewers}`].filter(Boolean).join('; ');
    out.meta.notes =
      lang === 'de'
        ? `Tonartenverlauf aus den Harmonie-Annotationen des DCML-Korpus${src?.repo ? ` „${src.repo}“` : ''}${people ? ` (${people})` : ''}. Lizenz und Zitierweise: siehe Repository des Korpus.`
        : `Key path taken from the harmonic annotations of the DCML corpus${src?.repo ? ` “${src.repo}”` : ''}${people ? ` (${people})` : ''}. For licence and how to cite, see the corpus repository.`;
  }
  return { piece: out, warnings, counts };
}

function firstGlobal(rows: Row[]): Key | null {
  for (const r of rows) {
    if (!r.globalkey) continue;
    const k = parseGlobalKey(r.globalkey);
    if (k) return k;
  }
  return null;
}
