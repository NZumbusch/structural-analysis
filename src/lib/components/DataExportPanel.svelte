<script lang="ts">
  import { computeStats } from '../analysis/stats';
  import { toCsv, type Column } from '../analysis/csv';
  import { buildTables, TABLE_IDS, toLatex, type Table, type TableId } from '../analysis/tables';
  import { fileSlug } from '../domain/piece';
  import type { Piece } from '../domain/types';
  import { analysisJson } from '../export/analysis-json';
  import { downloadBlob, slugify } from '../export/files';
  import { zip } from '../export/zip';
  import { t, type TKey } from '../i18n/index.svelte';
  import { app } from '../stores/app.svelte';

  let { piece }: { piece: Piece } = $props();

  let which = $state<TableId>('segments');
  let floating = $state(false);

  const lang = $derived(app.prefs.uiLang);
  const stats = $derived(computeStats(piece, { countRepeats: piece.style.repeatDisplay === 'expanded' }));
  const tables = $derived(buildTables(piece, stats, (k, p) => t(k as TKey, p), lang));
  const current = $derived(tables[which] as Table<unknown>);
  const base = $derived(fileSlug(piece));

  const csvText = (tb: Table<unknown>) => toCsv(tb.columns as Column<unknown>[], tb.rows, lang);
  const latexText = () => toLatex(current, { floating, caption: current.name, label: `tab:${which}` });

  const csv = () => downloadBlob(new Blob([csvText(current)], { type: 'text/csv;charset=utf-8' }), `${base}-${slugify(current.name)}.csv`);
  const tex = () => downloadBlob(new Blob([latexText()], { type: 'application/x-tex;charset=utf-8' }), `${base}-${slugify(current.name)}.tex`);
  async function copyLatex() {
    try {
      await navigator.clipboard.writeText(latexText());
      app.notify(t('data.copied'));
    } catch {
      app.notify(t('ex.copyFailed'));
    }
  }
  function allCsv() {
    const enc = new TextEncoder();
    const entries = TABLE_IDS.map((id) => ({ id, tb: tables[id] as Table<unknown> }))
      .filter(({ tb }) => tb.rows.length > 0)
      .map(({ id, tb }) => ({ name: `${base}-${slugify(tb.name) || id}.csv`, data: enc.encode(csvText(tb)) }));
    downloadBlob(new Blob([zip(entries) as BlobPart], { type: 'application/zip' }), `${base}-tabellen.zip`);
  }
  const json = () =>
    downloadBlob(new Blob([JSON.stringify(analysisJson(piece, stats), null, 2)], { type: 'application/json' }), `${base}.analysis.json`);
</script>

<details class="card box">
  <summary>
    <span class="chev" aria-hidden="true"></span>
    <h3>{t('data.title')}</h3>
  </summary>
  <div class="body">
    <p class="hint">{t('data.hint')}</p>
    <label class="field">
      <span>{t('data.table')}</span>
      <select bind:value={which}>
        {#each TABLE_IDS as id (id)}
          <option value={id}>{t(`tbl.set.${id}` as TKey)} ({tables[id].rows.length})</option>
        {/each}
      </select>
    </label>
    <label class="check"><input type="checkbox" bind:checked={floating} />{t('data.floating')}</label>
    <div class="line">
      <button class="btn" onclick={csv} disabled={current.rows.length === 0}>CSV</button>
      <button class="btn" onclick={tex} disabled={current.rows.length === 0}>LaTeX (.tex)</button>
      <button class="btn" onclick={copyLatex} disabled={current.rows.length === 0}>{t('data.copyLatex')}</button>
    </div>
    <div class="line">
      <button class="btn" onclick={allCsv}>{t('data.allCsv')}</button>
      <button class="btn" onclick={json}>{t('data.json')}</button>
    </div>
    <p class="hint">{t('data.jsonHint')}</p>
  </div>
</details>

<style>
  summary { display: flex; align-items: center; gap: 8px; padding: 12px 14px; cursor: pointer; list-style: none; user-select: none; }
  summary::-webkit-details-marker { display: none; }
  .body { padding: 0 14px 14px; display: grid; gap: 10px; }
  .check { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; }
</style>
