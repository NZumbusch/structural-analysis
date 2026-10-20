import { keyDistance } from '../domain/distance';
import { keyName, rowOf } from '../domain/keys';
import { sortedEvents } from '../domain/structure';
import type { Key, Piece } from '../domain/types';
import type { Stats } from '../analysis/stats';
import { stampOf } from './stamp';

/**
 * The analysis as plain data, without any chart settings — for reuse in other tools or as supplementary
 * material. The format is described in docs/analysis-format.md.
 */
export function analysisJson(piece: Piece, stats: Stats, now = new Date()): Record<string, unknown> {
  const names = piece.style.noteNames;
  const stamp = stampOf(piece, now);
  const center = piece.meta.center;
  const key = (k: Key) => ({ name: keyName(k, names), fifths: k.fifths, mode: k.mode, row: rowOf(k) });
  const withDistance = (k: Key) => ({ ...key(k), distance: keyDistance(center, k, stats.measure).distance });
  return {
    format: 'tonartenverlauf-analysis',
    version: 1,
    generator: { name: stamp.app, version: stamp.version },
    exportedAt: stamp.exported,
    work: {
      composer: piece.meta.composer,
      title: piece.meta.title,
      movement: piece.meta.movement,
      catalog: piece.meta.catalog,
      year: piece.meta.year,
      source: piece.meta.source ?? '',
      analyst: piece.meta.analyst ?? '',
      analysisDate: piece.meta.analysisDate ?? '',
    },
    conventions: {
      noteNames: names,
      positions: 'Bars; an integer is the start of that bar, fractions are parts of a bar. End positions are exclusive.',
      rows: 'fifths of the relative-major row counted from C (E-flat major / c minor = -3); sharp side positive',
      distanceMeasure: stats.measure,
    },
    homeKey: key(center),
    meter: piece.meta.meter,
    pickupBeats: piece.meta.pickup ?? 0,
    bars: stats.summary.pieceBars,
    segments: [...piece.segments]
      .sort((a, b) => a.from - b.from || a.to - b.to)
      .map((s) => ({ from: s.from, to: s.to, key: withDistance(s.key), kind: s.kind, label: s.label })),
    passingChords: [...piece.passing].sort((a, b) => a.pos - b.pos).map((p) => ({ pos: p.pos, key: withDistance(p.key) })),
    annotations: piece.annotations.map((a) => ({ pos: a.pos, key: key(a.key), text: a.text })),
    events: sortedEvents(piece).map((e) => {
      const base = { kind: e.kind, pos: e.pos };
      switch (e.kind) {
        case 'meter': return { ...base, beats: e.beats, unit: e.unit };
        case 'repeat-end': return { ...base, times: e.times };
        case 'volta': return { ...base, to: e.to, endings: e.numbers };
        case 'section': case 'subsection': return { ...base, name: e.name };
        case 'marker': case 'text': return { ...base, label: e.label };
        case 'barline': return { ...base, style: e.style };
        case 'keysig': return { ...base, fifths: e.fifths };
        default: return base;
      }
    }),
    summary: {
      analysedBars: stats.summary.analysedBars,
      distinctKeys: stats.summary.distinctKeys,
      modulations: stats.summary.modulations,
      maxDistance: stats.summary.maxDistance,
      meanDistance: stats.summary.meanDistance,
      shareAtDistance0: stats.summary.homeShare,
      shareInExactHomeKey: stats.summary.exactHomeShare,
      majorShare: stats.summary.majorShare,
      minorShare: stats.summary.minorShare,
    },
  };
}
