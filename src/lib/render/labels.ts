import type { Lang } from '../domain/types';

export interface ChartLabels {
  bar: string;
  fifths: string;
  major: string;
  minor: string;
  dominant: string;
  leading: string;
  neapolitan: string;
  tonicization: string;
  passing: string;
  subtitle: (majorName: string, minorName: string) => string;
}

export const CHART_LABELS: Record<Lang, ChartLabels> = {
  de: {
    bar: 'Takt',
    fifths: 'Quinten',
    major: 'Dur',
    minor: 'Moll',
    dominant: 'Zwischendominante der folgenden Tonart',
    leading: 'Zwischenleittonakkord der folgenden Tonart',
    neapolitan: 'Neapolitaner der folgenden Tonart',
    tonicization: 'Tonikalisierung der folgenden Tonart',
    passing: 'Durchgangsakkord',
    subtitle: (a, b) =>
      `Erreichte Tonarten nach Takt und Abstand auf dem Quintenzirkel zum Zentrum ${a}-Dur / ${b}-Moll`,
  },
  en: {
    bar: 'Bar',
    fifths: 'Fifths',
    major: 'Major',
    minor: 'Minor',
    dominant: 'Secondary dominant of the following key',
    leading: 'Secondary leading-tone chord of the following key',
    neapolitan: 'Neapolitan of the following key',
    tonicization: 'Tonicisation of the following key',
    passing: 'Passing chord',
    subtitle: (a, b) =>
      `Keys reached by bar and distance on the circle of fifths from the centre ${a} major / ${b} minor`,
  },
};
