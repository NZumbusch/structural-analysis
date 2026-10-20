import { rowOf, tonicName } from '../domain/keys';
import { barRange } from '../domain/positions';
import { hasRepeats, lastBarOf, startPos } from '../domain/structure';
import type { Piece } from '../domain/types';
import { computeStats } from './stats';

export interface CaptionOptions {
  /** Zoom range (exclusive end) when the figure shows a view. */
  view?: { from: number; to: number } | null;
  /** Figure number or label, e.g. "3" gives "Abb. 3: …". */
  figure?: string;
  /** Count repeats in play order (as chosen for the statistics). */
  countRepeats?: boolean;
}

export interface Caption {
  /** One or two sentences to put under the figure. */
  caption: string;
  /** Explains the conventions, for a figure note or the methods section. */
  method: string;
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const num = (n: number, lang: 'de' | 'en') => (lang === 'de' ? String(n).replace('.', ',') : String(n));

/** Plain-language caption and method note for the chart, in the language of the chart. */
export function buildCaption(piece: Piece, options: CaptionOptions = {}): Caption {
  const lang = piece.style.language;
  const de = lang === 'de';
  const { composer, title, movement, catalog } = piece.meta;
  const names = piece.style.noteNames;
  const center = piece.meta.center;
  const row = rowOf(center);
  const major = `${tonicName(row, names)}${de ? '-Dur' : ' major'}`;
  const minor = `${lowerFirst(tonicName(row + 3, names))}${de ? '-Moll' : ' minor'}`;

  // ---- what is shown -------------------------------------------------------------------------------
  const work = [composer.trim(), [title.trim(), movement.trim()].filter(Boolean).join(', ')].filter(Boolean).join(', ');
  const workWithCatalog = work + (catalog.trim() ? ` (${catalog.trim()})` : '');
  let range: string;
  if (options.view) {
    const [a, b] = barRange(options.view.from, options.view.to);
    range = b > a ? `${a}–${b}` : String(a);
  } else {
    range = `${startPos(piece) < 1 ? 0 : 1}–${lastBarOf(piece)}`;
  }
  const bars = de ? `T. ${range}` : `bars ${range}`;
  const lead = options.figure ? (de ? `Abb. ${options.figure}: ` : `Fig. ${options.figure}: `) : '';
  const subject = de ? 'Tonartenverlauf' : 'Key plan';
  const where = workWithCatalog ? (de ? ` in ${workWithCatalog}` : ` of ${workWithCatalog}`) : '';

  const hasKeys = piece.segments.some((s) => s.kind === 'key');
  const hasDominants = piece.segments.some((s) => s.kind === 'dominant');
  const hasPassing = piece.passing.length > 0;
  const keyDesc: string[] = [];
  if (hasKeys) keyDesc.push(de ? 'Balken zeigen die jeweils erreichte Tonart (Dur und Moll farblich unterschieden)' : 'bars show the key reached (major and minor distinguished by colour)');
  if (hasDominants) keyDesc.push(de ? 'gestrichelte Balken die Zwischendominante der folgenden Tonart' : 'dashed bars the secondary dominant of the following key');
  if (hasPassing) keyDesc.push(de ? 'Kreise Durchgangsakkorde' : 'circles passing chords');
  const legend = keyDesc.length ? `${keyDesc.join(de ? '; ' : '; ')}. ` : '';
  const rows = de
    ? `Die Zeilen ordnen die Tonarten nach ihrem Quintenabstand vom Zentrum ${major} / ${minor}.`
    : `The rows order the keys by their distance in fifths from the centre ${major} / ${minor}.`;
  const caption = `${lead}${subject}${where}, ${bars}. ${legend}${rows}`;

  // ---- conventions ---------------------------------------------------------------------------------------
  const measure = piece.meta.distanceMeasure ?? 'rows';
  const stats = computeStats(piece, { countRepeats: options.countRepeats });
  const sentences: string[] = [];
  sentences.push(
    de
      ? 'Positionen sind Taktzahlen; bei „bis“ steht der Takt, in dem die nächste Stelle beginnt, Dezimalzahlen bzw. Taktschläge bezeichnen Positionen innerhalb eines Taktes.'
      : 'Positions are bar numbers; an end position names the bar where the next stretch begins, and decimals or beats denote positions within a bar.',
  );
  sentences.push(
    de
      ? 'Jede Tonart steht in der Zeile ihrer Durtonart, Moll-Tonarten in der Zeile ihrer Paralleltonart.'
      : 'Each key sits in the row of its major key; minor keys are placed in the row of their relative major.',
  );
  if (measure === 'rows') {
    sentences.push(
      de
        ? `Abstand: Zahl der Quinten zwischen den Zeilen; Dur- und Paralleltonart (z. B. ${major} und ${minor}) haben denselben Abstand zum Zentrum, gleichnamige Tonarten (z. B. ${minor} und ${tonicName(row + 3, names)}-Dur) liegen drei Quinten auseinander.`
        : `Distance: the number of fifths between rows; a major key and its relative minor (e.g. ${major} and ${minor}) are equally far from the centre, keys with the same tonic (e.g. ${minor} and ${tonicName(row + 3, names)} major) are three fifths apart.`,
    );
  } else if (measure === 'tonic') {
    sentences.push(
      de
        ? 'Abstand: Zahl der Quinten zwischen den Grundtönen, unabhängig vom Tongeschlecht; gleichnamige Tonarten haben den Abstand 0, Paralleltonarten den Abstand 3.'
        : 'Distance: the number of fifths between the tonics regardless of mode; keys with the same tonic are 0 apart, relative keys 3 apart.',
    );
  } else {
    sentences.push(
      de
        ? 'Abstand: kürzeste Zahl von Schritten entlang der Beziehungen Quinte, Paralleltonart und gleichnamige Tonart (jeweils ein Schritt).'
        : 'Distance: the fewest steps along the relations fifth, relative key and same-tonic key (one step each).',
    );
  }
  if (hasDominants) {
    sentences.push(
      de
        ? 'Zwischendominanten werden der Zieltonart zugerechnet und in den Auswertungen gesondert ausgewiesen.'
        : 'Secondary dominants are attributed to the key they aim at and reported separately in the statistics.',
    );
  }
  const analysed = stats.summary.analysedBars;
  const total = stats.summary.pieceBars;
  if (stats.summary.gapBars > 0) {
    sentences.push(
      de
        ? `Zeitanteile beziehen sich auf die analysierten Takte (${num(analysed, lang)} von ${total}); Takte ohne Tonart, etwa nur mit Durchgangsakkorden, bleiben unberücksichtigt.`
        : `Time shares refer to the analysed bars (${num(analysed, lang)} of ${total}); bars without a key, such as passages of passing chords only, are left out.`,
    );
  }
  if (hasRepeats(piece)) {
    sentences.push(
      options.countRepeats
        ? de ? 'Wiederholungen werden in Spielreihenfolge gezählt.' : 'Repeats are counted in play order.'
        : de ? 'Wiederholte Takte werden einmal gezählt.' : 'Repeated bars are counted once.',
    );
  }
  return { caption, method: `${de ? 'Methode: ' : 'Method: '}${sentences.join(' ')}` };
}
