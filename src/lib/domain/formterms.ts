import type { Lang, Piece, StructEvent } from './types';

/**
 * Terms of form theory for labelling a piece. A *concept* (secondary theme, medial caesura …) has an
 * abbreviation in each vocabulary that knows it, and names in German and English. Parts and marks added from
 * the term buttons remember their concept, so the chart can show them in another vocabulary later.
 * The terms follow Hepokoski & Darcy, Elements of Sonata Theory (2006), and Caplin, Classical Form (1998);
 * the definitions are written in our own words.
 */
export type TermKind = 'zone' | 'point';
export type VocabId = 'sonata-theory' | 'caplin' | 'german';

export interface Concept {
  id: string;
  kind: TermKind;
  /** Points that mark a structural moment get a dashed line through the chart. */
  line?: boolean;
  de: string;
  en: string;
  defDe: string;
  defEn: string;
  abbr: Partial<Record<VocabId, string>>;
}

export const CONCEPTS: Concept[] = [
  { id: 'main', kind: 'zone', de: 'Hauptsatz', en: 'Main theme', abbr: { 'sonata-theory': 'P', caplin: 'MT', german: 'HS' }, defDe: 'Der eröffnende thematische Abschnitt; besteht aus einem oder mehreren thematischen Modulen (bei Hepokoski & Darcy „primary theme zone“).', defEn: 'The opening thematic unit; one or several thematic modules (primary theme zone in Hepokoski & Darcy).' },
  { id: 'transition', kind: 'zone', de: 'Überleitung', en: 'Transition', abbr: { 'sonata-theory': 'TR', caplin: 'TR', german: 'Ü' }, defDe: 'Abschnitt mit Energiezuwachs, der vom Hauptsatz zum Seitensatz führt und die Tonart wechselt; bei Hepokoski & Darcy mündet er in die Mediale Zäsur.', defEn: 'Area of energy gain that leads from the main theme to the second theme and changes the key; in Hepokoski & Darcy it ends at the medial caesura.' },
  { id: 'p-tr', kind: 'zone', de: 'Hauptsatz als Überleitung', en: 'Primary theme turning into transition', abbr: { 'sonata-theory': 'P⇒TR' }, defDe: 'Hauptthema und Überleitung sind verschmolzen: der Abschnitt beginnt als P und übernimmt später die Funktion einer TR.', defEn: 'Primary theme and transition merged: the section begins as a P and later takes the function of a TR.' },
  { id: 'second', kind: 'zone', de: 'Seitensatz', en: 'Secondary theme', abbr: { 'sonata-theory': 'S', caplin: 'ST', german: 'SS' }, defDe: 'Die erste thematische Einheit in der Nebentonart; bei Hepokoski & Darcy endet sie mit der perfekten authentischen Kadenz (EEC).', defEn: 'The first thematic unit in the secondary key; in Hepokoski & Darcy it ends with the perfect authentic cadence (the EEC).' },
  { id: 'closing', kind: 'zone', de: 'Schlussgruppe', en: 'Closing zone', abbr: { 'sonata-theory': 'C', caplin: 'CS', german: 'SG' }, defDe: 'Abschnitt nach der Hauptkadenz des Seitensatzes, der Kadenz und Abschluss bestätigt.', defEn: 'Follows the main cadence of the second theme and confirms cadence and closure.' },
  { id: 'retransition', kind: 'zone', de: 'Rückleitung', en: 'Retransition', abbr: { 'sonata-theory': 'RT', caplin: 'RT', german: 'RL' }, defDe: 'Rückführung aus der Durchführung zur Reprise, meist auf der Dominante endend.', defEn: 'Leads from the development back to the recapitulation, usually ending on the dominant.' },
  { id: 'antecedent', kind: 'zone', de: 'Vordersatz', en: 'Antecedent', abbr: { caplin: 'ant.', german: 'VS' }, defDe: 'Erster Teil einer Periode, endet meist mit einem Halbschluss.', defEn: 'First part of a period, usually ending with a half cadence.' },
  { id: 'consequent', kind: 'zone', de: 'Nachsatz', en: 'Consequent', abbr: { caplin: 'cons.', german: 'NS' }, defDe: 'Zweiter Teil einer Periode, endet mit einer authentischen Kadenz.', defEn: 'Second part of a period, ending with an authentic cadence.' },
  { id: 'presentation', kind: 'zone', de: 'Präsentation', en: 'Presentation', abbr: { caplin: 'pres.' }, defDe: 'Erste Phase eines Satzes: Grundidee und ihre Wiederholung.', defEn: 'First phase of a sentence: the basic idea and its repetition.' },
  { id: 'continuation', kind: 'zone', de: 'Fortspinnung', en: 'Continuation', abbr: { caplin: 'cont.', german: 'Fortspinnung' }, defDe: 'Fortlaufende, sequenzierende Passage mit Fragmentierung und Beschleunigung, die zur Kadenz führt.', defEn: 'A continuing, sequential passage of fragmentation and acceleration that leads to the cadence.' },
  { id: 'cadential', kind: 'zone', de: 'Kadenzgruppe', en: 'Cadential', abbr: { caplin: 'cad.' }, defDe: 'Kadenzphase am Ende eines Themas.', defEn: 'Cadential phase at the end of a theme.' },
  { id: 'coda', kind: 'zone', de: 'Coda', en: 'Coda', abbr: { german: 'Coda' }, defDe: 'Schlussabschnitt nach der Reprise.', defEn: 'Closing section after the recapitulation.' },
  { id: 'caesura', kind: 'point', line: true, de: 'Mediale Zäsur', en: 'Medial caesura', abbr: { 'sonata-theory': 'MC', german: 'Zäsur' }, defDe: 'Rhetorisch verstärkte Lücke, die die Exposition in zwei Teile teilt, meist ein Halbschluss in der Nebentonart – die Pause zwischen Hauptsatz und Seitensatz.', defEn: 'A rhetorically reinforced gap that divides the exposition into two parts, most often a half cadence in the secondary key.' },
  { id: 'eec', kind: 'point', line: true, de: 'Essential Expositional Closure', en: 'Essential expositional closure', abbr: { 'sonata-theory': 'EEC' }, defDe: 'Die entscheidende Kadenz der Exposition: die erste perfekte authentische Kadenz in der Nebentonart, sie schließt den Seitensatz.', defEn: 'The first perfect authentic cadence in the secondary key; it closes the S.' },
  { id: 'esc', kind: 'point', line: true, de: 'Essential Structural Closure', en: 'Essential structural closure', abbr: { 'sonata-theory': 'ESC' }, defDe: 'Meist die erste perfekte authentische Kadenz im Seitensatz der Reprise; entspricht dem EEC der Exposition.', defEn: 'Usually the first perfect authentic cadence in the S of the recapitulation; corresponds to the EEC.' },
  { id: 'hc', kind: 'point', de: 'Halbschluss', en: 'Half cadence', abbr: { 'sonata-theory': 'HC', caplin: 'HC', german: 'Halbschluss' }, defDe: 'Kadenz auf der Dominante.', defEn: 'A cadence on the dominant.' },
  { id: 'pac', kind: 'point', de: 'Vollkommener Ganzschluss', en: 'Perfect authentic cadence', abbr: { 'sonata-theory': 'PAC', caplin: 'PAC', german: 'Vollk. Ganzschluss' }, defDe: 'V–I mit dem Grundton in Bass und Melodie.', defEn: 'V–I with the tonic in bass and melody.' },
  { id: 'iac', kind: 'point', de: 'Unvollkommener Ganzschluss', en: 'Imperfect authentic cadence', abbr: { 'sonata-theory': 'IAC', caplin: 'IAC', german: 'Unvollk. Ganzschluss' }, defDe: 'V–I, aber ohne Grundton in der Melodie.', defEn: 'V–I, but without the tonic in the melody.' },
  { id: 'dc', kind: 'point', de: 'Trugschluss', en: 'Deceptive cadence', abbr: { 'sonata-theory': 'DC', caplin: 'DC', german: 'Trugschluss' }, defDe: 'V–VI statt V–I.', defEn: 'V–VI instead of V–I.' },
];

/** A concept as one vocabulary spells it (what a term button shows). */
export interface FormTerm extends Concept {
  /** The abbreviation in the vocabulary the term was taken from. */
  short: string;
}

export const VOCABULARIES: { id: VocabId; terms: FormTerm[] }[] = (['sonata-theory', 'caplin', 'german'] as VocabId[]).map((id) => ({
  id,
  terms: CONCEPTS.filter((c) => c.abbr[id]).map((c) => ({ ...c, short: c.abbr[id]! })),
}));

export const termsOf = (id: VocabId, kind: TermKind): FormTerm[] => VOCABULARIES.find((v) => v.id === id)!.terms.filter((t) => t.kind === kind);
export const termName = (term: Concept, lang: Lang) => (lang === 'de' ? term.de : term.en);
export const termDefinition = (term: Concept, lang: Lang) => (lang === 'de' ? term.defDe : term.defEn);

// ---- showing terms in another vocabulary ---------------------------------------------------------------------------

/** How terms are shown in the chart: as entered, in a vocabulary's abbreviations, or by name. */
export type TermDisplay = 'entered' | VocabId | 'name-de' | 'name-en' | 'abbr-name-de';
export const TERM_DISPLAYS: TermDisplay[] = ['entered', 'sonata-theory', 'caplin', 'german', 'name-de', 'name-en', 'abbr-name-de'];

/** The text to show for a part or mark; what was typed by hand, or has no counterpart, stays as it is. */
export function termLabel(conceptId: string, entered: string, mode: TermDisplay): string {
  if (!conceptId || mode === 'entered') return entered;
  const c = CONCEPTS.find((x) => x.id === conceptId);
  if (!c) return entered;
  switch (mode) {
    case 'sonata-theory':
    case 'caplin':
    case 'german':
      return c.abbr[mode] ?? entered;
    case 'name-de':
      return c.de;
    case 'name-en':
      return c.en;
    case 'abbr-name-de': {
      const abbr = c.abbr['sonata-theory'] ?? c.abbr.caplin ?? c.abbr.german;
      return abbr && abbr !== c.de ? `${abbr} (${c.de})` : c.de;
    }
  }
}

/** The piece with its remembered terms shown the way the style asks for. */
export function withTerms(piece: Piece): Piece {
  const mode = piece.style.termDisplay ?? 'entered';
  if (mode === 'entered' || !piece.events.some((e) => e.term)) return piece;
  const shown = (e: StructEvent): StructEvent => {
    if (!e.term) return e;
    if (e.kind === 'subsection') return { ...e, name: termLabel(e.term, e.name, mode) };
    if (e.kind === 'marker' || e.kind === 'text') return { ...e, label: termLabel(e.term, e.label, mode) };
    return e;
  };
  return { ...piece, events: piece.events.map(shown) };
}
