import type { TKey } from '../i18n/index.svelte';

/**
 * Every setting of the export tab in one list, so the tab can be browsed by group or searched by words.
 * A setting is either a simple control bound to a path (`style.show.grid`, `export.widthCm`) or a
 * custom block (palette, row names …) that the panel renders itself.
 */
export type GroupId = 'print' | 'look' | 'text' | 'content';
export const GROUPS: { id: GroupId; label: TKey }[] = [
  { id: 'print', label: 'set.g.print' },
  { id: 'look', label: 'set.g.look' },
  { id: 'text', label: 'set.g.text' },
  { id: 'content', label: 'set.g.content' },
];

export interface Choice {
  value: string | number;
  /** An i18n key, or a literal text. */
  label: TKey | { text: string };
}

export type CustomId = 'presets' | 'widths' | 'fit' | 'checks' | 'palette' | 'colors' | 'cmyk' | 'rowNames' | 'legendLabels' | 'barWidth';

export type Control =
  | { type: 'toggle'; path: string }
  | { type: 'select'; path: string; options: Choice[] }
  | { type: 'range'; path: string; min: number; max: number; step: number; format?: 'pct' | 'int' }
  | { type: 'number'; path: string; min?: number; max?: number; step?: number; nullable?: boolean }
  | { type: 'text'; path: string; placeholder?: TKey }
  | { type: 'custom'; id: CustomId };

export interface Setting {
  id: string;
  group: GroupId;
  label: TKey;
  hint?: TKey;
  /** More words (German and English) that should find this setting. */
  keywords: string;
  control: Control;
  /** Hidden in the simple view on phones. */
  advanced?: boolean;
  /** Only meaningful in some situations; the panel hides it otherwise. */
  when?: 'physical' | 'scale';
}

const auto: Choice = { value: 'auto', label: 'common.auto' };
const on: Choice = { value: 'on', label: 'common.on' };
const off: Choice = { value: 'off', label: 'common.off' };
const tickSteps = [0, 1, 2, 4, 5, 8, 10, 16, 20, 25, 50, 100];

const toggle = (id: string, group: GroupId, label: TKey, path: string, keywords: string, extra: Partial<Setting> = {}): Setting => ({
  id, group, label, keywords, control: { type: 'toggle', path }, ...extra,
});

export const SETTINGS: Setting[] = [
  // ---- format & print --------------------------------------------------------------------------------
  { id: 'presets', group: 'print', label: 'set.s.presets', keywords: 'voreinstellung vorlage zeitschrift verlag spalte druck folie präsentation schwarz weiß preset journal column print slide black white', control: { type: 'custom', id: 'presets' } },
  { id: 'widths', group: 'print', label: 'set.s.size', keywords: 'größe breite cm spalte textbreite seite format size width column page', control: { type: 'custom', id: 'widths' } },
  { id: 'scale', group: 'print', label: 'ex.pngScale', keywords: 'png vergrößerung faktor scale zoom', control: { type: 'select', path: 'export.scale', options: [1, 2, 3, 4, 6].map((n) => ({ value: n, label: { text: `${n}×` } })) }, when: 'scale' },
  { id: 'dpi', group: 'print', label: 'ex.dpi', keywords: 'auflösung dpi pixel png resolution', control: { type: 'select', path: 'export.dpi', options: [150, 300, 600, 1200].map((n) => ({ value: n, label: { text: String(n) } })) }, when: 'physical' },
  { id: 'fit', group: 'print', label: 'set.s.textSize', keywords: 'schrift größe pt punkt lesbar anpassen font size points legible fit height höhe', control: { type: 'custom', id: 'fit' }, when: 'physical' },
  { id: 'margins', group: 'print', label: 'set.s.margins', hint: 'set.h.margins', keywords: 'rand ränder beschnitt weißraum zuschneiden eng margin crop whitespace tight padding', control: { type: 'select', path: 'style.margins', options: [{ value: 'normal', label: 'set.margins.normal' }, { value: 'tight', label: 'set.margins.tight' }] } },
  { id: 'fonts', group: 'print', label: 'ex.fonts', keywords: 'schrift einbetten umrisse pfade font embed outline paths', control: { type: 'select', path: 'export.fonts', options: [{ value: 'embed', label: 'ex.fonts.embed' }, { value: 'outline', label: 'ex.fonts.outline' }, { value: 'none', label: 'ex.fonts.none' }] }, advanced: true },
  toggle('stamp', 'print', 'ex.stamp', 'export.stamp', 'metadaten herkunft version datum stempel metadata provenance', { advanced: true }),
  toggle('grayscale', 'print', 'set.s.grayscale', 'export.grayscale', 'graustufen schwarz weiß s/w vorschau grayscale black white preview', { advanced: true }),
  { id: 'checks', group: 'print', label: 'set.s.checks', keywords: 'prüfliste prüfen kontrolle veröffentlichung checkliste check checklist publish', control: { type: 'custom', id: 'checks' } },

  // ---- look --------------------------------------------------------------------------------------------
  { id: 'palette', group: 'look', label: 'set.s.palette', keywords: 'farben palette schema klassisch kräftig warm farbenblind schwarz weiß dunkel colour color scheme', control: { type: 'custom', id: 'palette' } },
  { id: 'colors', group: 'look', label: 'ex.colors', keywords: 'farbe dur moll füllung rand text raster achse hintergrund color major minor fill stroke background', control: { type: 'custom', id: 'colors' }, advanced: true },
  toggle('hatch', 'look', 'st.hatch', 'style.hatch', 'schraffur schraffieren moll schwarz weiß druck hatch pattern black white'),
  toggle('transparent', 'look', 'st.transparent', 'style.transparentBackground', 'transparent hintergrund durchsichtig background', { advanced: true }),
  { id: 'barShape', group: 'look', label: 'set.s.barShape', keywords: 'balken form eckig rund abgerundet ecken shape corner round square rectangle', control: { type: 'select', path: 'style.barShape', options: [{ value: 'round', label: 'set.bar.round' }, { value: 'square', label: 'set.bar.square' }] }, advanced: true },
  { id: 'barHeight', group: 'look', label: 'st.barHeight', keywords: 'balken höhe dicke bar height thickness', control: { type: 'range', path: 'style.barHeight', min: 6, max: 32, step: 1, format: 'int' }, advanced: true },
  { id: 'rowHeight', group: 'look', label: 'st.rowHeight', keywords: 'zeilenabstand zeile höhe abstand row height spacing', control: { type: 'range', path: 'style.rowHeight', min: 22, max: 72, step: 1, format: 'int' }, advanced: true },
  { id: 'lineScale', group: 'look', label: 'set.s.lineScale', hint: 'set.h.lineScale', keywords: 'linie linien stärke dicke strichstärke haarlinie line width weight stroke thin thick', control: { type: 'range', path: 'style.lineScale', min: 0.5, max: 3, step: 0.1, format: 'pct' }, advanced: true },
  { id: 'fontFamily', group: 'look', label: 'st.fontFamily', keywords: 'schrift schriftart serif serifenlos font family typeface', control: { type: 'select', path: 'style.fontFamily', options: [{ value: 'sans', label: 'st.font.sans' }, { value: 'serif', label: 'st.font.serif' }, { value: 'mono', label: 'st.font.mono' }] }, advanced: true },
  { id: 'fontScale', group: 'look', label: 'st.fontScale', keywords: 'schriftgröße text größe font size scale', control: { type: 'range', path: 'style.fontScale', min: 0.7, max: 1.8, step: 0.05, format: 'pct' } },
  { id: 'cmyk', group: 'look', label: 'st.cmyk', hint: 'st.cmykHint', keywords: 'cmyk druckfarben vierfarbdruck offset print colours', control: { type: 'custom', id: 'cmyk' }, advanced: true },

  // ---- text ----------------------------------------------------------------------------------------------
  toggle('title', 'text', 'show.title', 'style.show.title', 'titel überschrift kopfzeile headline heading title caption bildunterschrift'),
  toggle('subtitle', 'text', 'show.subtitle', 'style.show.subtitle', 'untertitel zeile unter dem titel subtitle'),
  { id: 'titleLayout', group: 'text', label: 'st.titleLayout', keywords: 'titel komponist reihenfolge layout composer order', control: { type: 'select', path: 'style.titleLayout', options: [{ value: 'composer-title', label: 'st.layout.composer-title' }, { value: 'title-composer', label: 'st.layout.title-composer' }, { value: 'title', label: 'st.layout.title' }] }, advanced: true },
  toggle('showYear', 'text', 'st.showYear', 'style.showYear', 'jahr entstehung year date', { advanced: true }),
  { id: 'language', group: 'text', label: 'st.language', keywords: 'sprache deutsch englisch language german english', control: { type: 'select', path: 'style.language', options: [{ value: 'de', label: { text: 'Deutsch' } }, { value: 'en', label: { text: 'English' } }] } },
  { id: 'termDisplay', group: 'text', label: 'set.s.termDisplay', hint: 'set.h.termDisplay', keywords: 'formenlehre begriffe hauptsatz seitensatz überleitung schlussgruppe hepokoski darcy caplin sonata theory terms mc eec esc kürzel abkürzung abbreviation vocabulary translate umschalten', control: { type: 'select', path: 'style.termDisplay', options: (['entered', 'sonata-theory', 'caplin', 'german', 'name-de', 'name-en', 'abbr-name-de'] as const).map((m) => ({ value: m, label: `set.td.${m}` as const })) } },
  { id: 'noteNames', group: 'text', label: 'st.noteNames', keywords: 'notennamen h b es bb eb deutsch englisch note names spelling', control: { type: 'select', path: 'style.noteNames', options: [{ value: 'de', label: 'st.names.de' }, { value: 'en', label: 'st.names.en' }] } },
  { id: 'axisTitle', group: 'text', label: 'set.s.axisTitle', keywords: 'takt achse beschriftung titel bar axis label', control: { type: 'text', path: 'style.axisTitle', placeholder: 'common.auto' }, advanced: true },
  { id: 'fifthsTitle', group: 'text', label: 'set.s.fifthsTitle', keywords: 'quinten spalte überschrift abstand fifths column heading distance', control: { type: 'text', path: 'style.fifthsTitle', placeholder: 'common.auto' }, advanced: true },
  toggle('fifthsSigned', 'text', 'set.s.fifthsSigned', 'style.fifthsSigned', 'quinten vorzeichen plus minus kreuze b signed sharps flats', { advanced: true }),
  toggle('legend', 'text', 'show.legend', 'style.show.legend', 'legende erklärung legend key'),
  { id: 'legendLabels', group: 'text', label: 'set.s.legendLabels', keywords: 'legende text beschriftung umbenennen dominante zwischendominante dur moll legend wording rename', control: { type: 'custom', id: 'legendLabels' }, advanced: true },
  toggle('rowLabels', 'text', 'show.rowLabels', 'style.show.rowLabels', 'zeilen tonart beschriftung links row labels'),
  { id: 'enharmonic', group: 'text', label: 'st.enharmonic', hint: 'st.enharmonicHint', keywords: 'enharmonisch ges fis cis des schreibweise enharmonic flats sharps', control: { type: 'select', path: 'style.enharmonic', options: [auto, { value: 'flats', label: 'st.enh.flats' }, { value: 'sharps', label: 'st.enh.sharps' }] }, advanced: true },
  { id: 'rowNames', group: 'text', label: 'st.rowNames', keywords: 'zeilen namen beschriftung einzeln ändern row names custom labels', control: { type: 'custom', id: 'rowNames' }, advanced: true },
  { id: 'tickStep', group: 'text', label: 'st.tickStep', keywords: 'taktzahlen achse abstand ticks bar numbers step interval', control: { type: 'select', path: 'style.tickStep', options: tickSteps.map((s) => (s === 0 ? { value: 0, label: 'common.auto' as const } : { value: s, label: { text: String(s) } })) }, advanced: true },
  toggle('axis', 'text', 'show.axis', 'style.show.axis', 'achse takt axis bar numbers'),
  toggle('sectionLabels', 'text', 'show.sectionLabels', 'style.show.sectionLabels', 'formteil namen exposition durchführung reprise section names'),
  toggle('subsections', 'text', 'show.subsections', 'style.show.subsections', 'unterteile themen subsections themes', { advanced: true }),
  toggle('barLabels', 'text', 'show.barLabels', 'style.show.barLabels', 'text auf balken bar labels', { advanced: true }),
  toggle('annotations', 'text', 'show.annotations', 'style.show.annotations', 'anmerkungen notizen annotations notes'),
  toggle('viewRange', 'text', 'show.viewRange', 'style.show.viewRange', 'ausschnitt taktbereich untertitel view range subtitle', { advanced: true }),

  // ---- content -----------------------------------------------------------------------------------------------
  toggle('grid', 'content', 'show.grid', 'style.show.grid', 'raster linien gitter grid lines'),
  toggle('sectionBands', 'content', 'show.sectionBands', 'style.show.sectionBands', 'formteil hintergrund band section background shading'),
  toggle('centerBand', 'content', 'show.centerBand', 'style.show.centerBand', 'zentrum zeile hervorheben gelb center row highlight'),
  toggle('repeats', 'content', 'show.repeats', 'style.show.repeats', 'wiederholung klammer taktstrich volta repeat signs barlines'),
  { id: 'repeatDisplay', group: 'content', label: 'setup.repeatDisplay', keywords: 'wiederholungen ausschreiben spielreihenfolge zeichen repeat expanded play order symbols', control: { type: 'select', path: 'style.repeatDisplay', options: [{ value: 'symbols', label: 'setup.repeat.symbols' }, { value: 'expanded', label: 'setup.repeat.expanded' }] }, advanced: true },
  toggle('meterSigns', 'content', 'show.meterSigns', 'style.show.meterSigns', 'taktart takt meter time signature', { advanced: true }),
  toggle('markers', 'content', 'show.markers', 'style.show.markers', 'marken marker kadenz cadence pac hc rehearsal'),
  toggle('connectors', 'content', 'show.connectors', 'style.show.connectors', 'verbindungslinien linien connectors joins'),
  toggle('fifthsColumn', 'content', 'show.fifthsColumn', 'style.show.fifthsColumn', 'quinten spalte rechts abstand fifths column distance'),
  toggle('fold', 'content', 'st.fold', 'style.foldTonicizations', 'zwischendominante tonikalisierung einrechnen verbergen secondary dominant tonicization fold hide'),
  { id: 'barLines', group: 'content', label: 'st.barLines', keywords: 'taktlinien vergrößern ausschnitt bar lines zoom', control: { type: 'select', path: 'style.barLines', options: [auto, on, off] }, advanced: true },
  { id: 'beatTicks', group: 'content', label: 'st.beatTicks', keywords: 'schlag striche achse beat ticks', control: { type: 'select', path: 'style.beatTicks', options: [auto, on, off] }, advanced: true },
  { id: 'extraRows', group: 'content', label: 'st.extraRows', keywords: 'zeilen zusätzliche mehr platz extra rows', control: { type: 'number', path: 'style.extraRows', min: 0, max: 6 }, advanced: true },
  { id: 'rowMax', group: 'content', label: 'st.rowMax', hint: 'st.rowRangeHint', keywords: 'oberste zeile bereich quinten höhe top row range limit', control: { type: 'number', path: 'style.rowMax', nullable: true }, advanced: true },
  { id: 'rowMin', group: 'content', label: 'st.rowMin', hint: 'st.rowRangeHint', keywords: 'unterste zeile bereich quinten bottom row range limit', control: { type: 'number', path: 'style.rowMin', nullable: true }, advanced: true },
  { id: 'barWidth', group: 'content', label: 'st.barWidth', keywords: 'breite takt pro takt bar width horizontal', control: { type: 'custom', id: 'barWidth' }, advanced: true },
  { id: 'detailWidth', group: 'content', label: 'st.detailWidth', keywords: 'ausschnitte breite zoom detail width views', control: { type: 'range', path: 'style.detailWidth', min: 300, max: 1600, step: 20, format: 'int' }, advanced: true },
];

// ---- paths -----------------------------------------------------------------------------------------------------

export type Roots = Record<string, unknown>;

export function getValue(roots: Roots, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), roots);
}

export function setValue(roots: Roots, path: string, value: unknown): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  const target = keys.reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], roots) as Record<string, unknown>;
  target[last] = value;
}

// ---- search ----------------------------------------------------------------------------------------------------

/** Lower case, without accents and ß, so that "Schriftgroesse", "schriftgröße" and "SCHRIFTGRÖSSE" all meet. */
export const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // "groesse" typed on a keyboard without umlauts meets "größe"
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');

/** Settings whose label, hint, keywords or group contain every word of the query; best matches (in the label) first. */
export function searchSettings(query: string, tr: (key: TKey) => string, list: Setting[] = SETTINGS): Setting[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return list;
  const scored: { s: Setting; score: number; i: number }[] = [];
  list.forEach((s, i) => {
    const label = fold(tr(s.label));
    const rest = fold(`${s.hint ? tr(s.hint) : ''} ${s.keywords} ${tr(GROUPS.find((g) => g.id === s.group)!.label)}`);
    let score = 0;
    for (const w of words) {
      if (label.includes(w)) score += label.startsWith(w) ? 3 : 2;
      else if (rest.includes(w)) score += 1;
      else return;
    }
    scored.push({ s, score, i });
  });
  return scored.sort((a, b) => b.score - a.score || a.i - b.i).map((x) => x.s);
}
