import type { Lang } from './types';

/**
 * Terms of form theory for labelling a piece: zones (spans like P, TR, S, C) and points (MC, EEC, cadences).
 * The wording of the definitions is ours; the terms follow Hepokoski & Darcy, Elements of Sonata Theory (2006),
 * and Caplin, Classical Form (1998).
 */
export type TermKind = 'zone' | 'point';

export interface FormTerm {
  abbr: string;
  de: string;
  en: string;
  kind: TermKind;
  /** Points that mark a structural moment get a dashed line through the chart. */
  line?: boolean;
  defDe: string;
  defEn: string;
}

export type VocabId = 'sonata-theory' | 'caplin' | 'german';

const CAD: FormTerm[] = [
  { abbr: 'HC', de: 'Halbschluss', en: 'Half cadence', kind: 'point', defDe: 'Halbschluss: Kadenz auf der Dominante.', defEn: 'Half cadence: a cadence on the dominant.' },
  { abbr: 'PAC', de: 'Perfekter authentischer Schluss', en: 'Perfect authentic cadence', kind: 'point', defDe: 'Vollkommener Ganzschluss: V–I mit Grundton in Bass und Melodie.', defEn: 'V–I with the tonic in bass and melody.' },
  { abbr: 'IAC', de: 'Imperfekter authentischer Schluss', en: 'Imperfect authentic cadence', kind: 'point', defDe: 'Unvollkommener Ganzschluss: V–I, aber ohne Grundton in der Melodie.', defEn: 'V–I, but without the tonic in the melody.' },
  { abbr: 'DC', de: 'Trugschluss', en: 'Deceptive cadence', kind: 'point', defDe: 'Trugschluss: V–VI statt V–I.', defEn: 'V–VI instead of V–I.' },
];

export const VOCABULARIES: { id: VocabId; terms: FormTerm[] }[] = [
  {
    id: 'sonata-theory',
    terms: [
      { abbr: 'P', de: 'Hauptthemenzone (Hauptsatz)', en: 'Primary theme zone', kind: 'zone', defDe: 'Der eröffnende thematische Abschnitt; besteht aus einem oder mehreren thematischen Modulen.', defEn: 'The opening thematic unit; one or several thematic modules.' },
      { abbr: 'TR', de: 'Überleitung', en: 'Transition', kind: 'zone', defDe: 'Abschnitt mit Energiezuwachs, der zur Medialen Zäsur (MC) führt.', defEn: 'Area of energy gain that leads to the medial caesura.' },
      { abbr: 'P⇒TR', de: 'Hauptsatz wird zur Überleitung', en: 'Primary theme turning into transition', kind: 'zone', defDe: 'Hauptthema und Überleitung sind verschmolzen: der Abschnitt beginnt als P und übernimmt später die Funktion einer TR.', defEn: 'Primary theme and transition merged: the section begins as a P and later takes the function of a TR.' },
      { abbr: 'S', de: 'Seitensatzzone (Seitensatz)', en: 'Secondary theme zone', kind: 'zone', defDe: 'Die erste thematische Einheit in der Nebentonart; endet mit einer perfekten authentischen Kadenz (EEC).', defEn: 'The first thematic unit in the secondary key; ends in a perfect authentic cadence (the EEC).' },
      { abbr: 'C', de: 'Schlussgruppe (Schlusssatz)', en: 'Closing zone', kind: 'zone', defDe: 'Post-kadenzielle Module nach dem EEC, die Kadenz und Abschluss bestätigen.', defEn: 'Post-cadential modules after the EEC that confirm cadence and closure.' },
      { abbr: 'RT', de: 'Rückleitung', en: 'Retransition', kind: 'zone', defDe: 'Rückführung aus der Durchführung zur Reprise, meist auf der Dominante endend.', defEn: 'Leads from the development back to the recapitulation, usually ending on the dominant.' },
      { abbr: 'MC', de: 'Mediale Zäsur', en: 'Medial caesura', kind: 'point', line: true, defDe: 'Rhetorisch verstärkte Lücke, die die Exposition in zwei Teile teilt, meist ein Halbschluss in der Nebentonart – die Pause zwischen Hauptsatz und Seitensatz.', defEn: 'A rhetorically reinforced gap that divides the exposition into two parts, most often a half cadence in the secondary key.' },
      { abbr: 'EEC', de: 'Essential Expositional Closure', en: 'Essential expositional closure', kind: 'point', line: true, defDe: 'Die entscheidende Kadenz der Exposition: die erste perfekte authentische Kadenz in der Nebentonart, sie schließt den Seitensatz.', defEn: 'The first perfect authentic cadence in the secondary key; it closes the S.' },
      { abbr: 'ESC', de: 'Essential Structural Closure', en: 'Essential structural closure', kind: 'point', line: true, defDe: 'Meist die erste perfekte authentische Kadenz im Seitensatz der Reprise; entspricht dem EEC der Exposition.', defEn: 'Usually the first perfect authentic cadence in the S of the recapitulation; corresponds to the EEC.' },
      ...CAD,
    ],
  },
  {
    id: 'caplin',
    terms: [
      { abbr: 'MT', de: 'Hauptthema', en: 'Main theme', kind: 'zone', defDe: 'Das eröffnende Thema (Satz, Periode oder ähnliche Themenform).', defEn: 'The opening theme (sentence, period or similar).' },
      { abbr: 'TR', de: 'Überleitung', en: 'Transition', kind: 'zone', defDe: 'Abschnitt, der vom Hauptthema zum Seitenthema überleitet und die Tonart wechselt.', defEn: 'Leads from the main theme to the subordinate theme and changes the key.' },
      { abbr: 'ST', de: 'Seitenthema', en: 'Subordinate theme', kind: 'zone', defDe: 'Das zweite Thema in der Nebentonart (bei Caplin „subordinate theme“).', defEn: 'The second theme in the new key.' },
      { abbr: 'CS', de: 'Schlussgruppe', en: 'Closing section', kind: 'zone', defDe: 'Abschnitt nach der Hauptkadenz des Seitenthemas, der den Abschluss bestätigt.', defEn: 'Follows the main cadence of the subordinate theme and confirms closure.' },
      { abbr: 'RT', de: 'Rückleitung', en: 'Retransition', kind: 'zone', defDe: 'Bereitet am Ende der Durchführung die Reprise vor.', defEn: 'Prepares the recapitulation at the end of the development.' },
      { abbr: 'pres.', de: 'Präsentation', en: 'Presentation', kind: 'zone', defDe: 'Erste Phase eines Satzes: Grundidee und ihre Wiederholung.', defEn: 'First phase of a sentence: the basic idea and its repetition.' },
      { abbr: 'cont.', de: 'Fortspinnung', en: 'Continuation', kind: 'zone', defDe: 'Fortlaufende, sequenzierende Passage mit Fragmentierung und Beschleunigung, die zur Kadenz führt.', defEn: 'Phase of fragmentation and acceleration that leads to the cadence.' },
      { abbr: 'cad.', de: 'Kadenzgruppe', en: 'Cadential', kind: 'zone', defDe: 'Kadenzphase am Ende eines Themas.', defEn: 'Cadential phase at the end of a theme.' },
      { abbr: 'ant.', de: 'Vordersatz', en: 'Antecedent', kind: 'zone', defDe: 'Erster Teil einer Periode, endet meist mit einem Halbschluss.', defEn: 'First part of a period, usually ending with a half cadence.' },
      { abbr: 'cons.', de: 'Nachsatz', en: 'Consequent', kind: 'zone', defDe: 'Zweiter Teil einer Periode, endet mit einer authentischen Kadenz.', defEn: 'Second part of a period, ending with an authentic cadence.' },
      ...CAD,
    ],
  },
  {
    id: 'german',
    terms: [
      { abbr: 'HS', de: 'Hauptsatz', en: 'Main theme', kind: 'zone', defDe: 'Das eröffnende Thema des Satzes.', defEn: 'The opening theme.' },
      { abbr: 'Ü', de: 'Überleitung', en: 'Transition', kind: 'zone', defDe: 'Überleitung vom Haupt- zum Seitensatz.', defEn: 'Transition from the main to the second theme.' },
      { abbr: 'SS', de: 'Seitensatz', en: 'Second theme', kind: 'zone', defDe: 'Das zweite Thema, in der Exposition in der Nebentonart.', defEn: 'The second theme, in the new key in the exposition.' },
      { abbr: 'SG', de: 'Schlussgruppe', en: 'Closing group', kind: 'zone', defDe: 'Abschließender Abschnitt der Exposition.', defEn: 'Closing section of the exposition.' },
      { abbr: 'RL', de: 'Rückleitung', en: 'Retransition', kind: 'zone', defDe: 'Rückführung zur Reprise.', defEn: 'Leads back to the recapitulation.' },
      { abbr: 'VS', de: 'Vordersatz', en: 'Antecedent', kind: 'zone', defDe: 'Erster Teil einer Periode.', defEn: 'First part of a period.' },
      { abbr: 'NS', de: 'Nachsatz', en: 'Consequent', kind: 'zone', defDe: 'Zweiter Teil einer Periode.', defEn: 'Second part of a period.' },
      { abbr: 'Fortspinnung', de: 'Fortspinnung', en: 'Continuation', kind: 'zone', defDe: 'Fortlaufende, sequenzierende Passage.', defEn: 'A continuing, sequential passage.' },
      { abbr: 'Coda', de: 'Coda', en: 'Coda', kind: 'zone', defDe: 'Schlussabschnitt nach der Reprise.', defEn: 'Closing section after the recapitulation.' },
      { abbr: 'Zäsur', de: 'Zäsur', en: 'Caesura', kind: 'point', line: true, defDe: 'Einschnitt zwischen Haupt- und Seitensatz (die Mediale Zäsur).', defEn: 'The break between main and second theme (the medial caesura).' },
      { abbr: 'Halbschluss', de: 'Halbschluss', en: 'Half cadence', kind: 'point', defDe: 'Kadenz auf der Dominante.', defEn: 'A cadence on the dominant.' },
      { abbr: 'Ganzschluss', de: 'Ganzschluss', en: 'Authentic cadence', kind: 'point', defDe: 'Kadenz V–I.', defEn: 'A cadence V–I.' },
      { abbr: 'Trugschluss', de: 'Trugschluss', en: 'Deceptive cadence', kind: 'point', defDe: 'V–VI statt V–I.', defEn: 'V–VI instead of V–I.' },
    ],
  },
];

export const termsOf = (id: VocabId, kind: TermKind): FormTerm[] => VOCABULARIES.find((v) => v.id === id)!.terms.filter((t) => t.kind === kind);
export const termName = (term: FormTerm, lang: Lang) => (lang === 'de' ? term.de : term.en);
export const termDefinition = (term: FormTerm, lang: Lang) => (lang === 'de' ? term.defDe : term.defEn);
