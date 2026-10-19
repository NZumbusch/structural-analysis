import { app } from '../stores/app.svelte';
import { de } from './de';
import { en } from './en';

export type TKey = keyof typeof de;

const dictionaries = { de, en } as const;

/** Translates a UI string. Reads the reactive language, so it works inside templates. */
export function t(key: TKey, params?: Record<string, string | number>): string {
  let text: string = dictionaries[app.prefs.uiLang][key] ?? de[key];
  if (params) for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
}
