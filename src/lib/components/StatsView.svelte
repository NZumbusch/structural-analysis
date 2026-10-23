<script lang="ts">
  import { remember } from '../ui/remember';
  import { chartDistance, chartKeys, chartProfile, chartSections, keyDisplay, unitPlural, type KeyOrder } from '../analysis/charts';
  import { formatNumber, formatPercent, type Column } from '../analysis/csv';
  import { computeStats } from '../analysis/stats';
  import { buildTables } from '../analysis/tables';
  import { rowLabel } from '../domain/keys';
  import { hasRepeats, meterMap } from '../domain/structure';
  import { buildCaption } from '../analysis/caption';
  import { fileSlug } from '../domain/piece';
  import { DISTANCE_MEASURES } from '../domain/distance';
  import { formatPos } from '../domain/positions';
  import type { Piece } from '../domain/types';
  import { app } from '../stores/app.svelte';
  import { t, type TKey } from '../i18n/index.svelte';
  import ChartCard from './ChartCard.svelte';
  import DataTable from './DataTable.svelte';

  let { piece }: { piece: Piece } = $props();

  let order = $state<KeyOrder>('duration');
  let signed = $state(false);
  let countRepeats = $state(false);
  let exactHome = $state(false);

  const stats = $derived(computeStats(piece, { countRepeats }));
  const method = $derived(buildCaption(piece, { countRepeats }).method);
  const s = $derived(stats.summary);
  const lang = $derived(app.prefs.uiLang);
  const meter = $derived(meterMap(piece));
  const base = $derived(fileSlug(piece));

  const num = (n: number, digits = 2) => formatNumber(n, lang, digits);
  const pct = (n: number) => formatPercent(n, lang);
  const pos = (p: number) => formatPos(p, meter);
  const step = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
  const rowName = (r: number) => rowLabel(r, piece.style.noteNames, piece.style.enharmonic);

  const tables = $derived(buildTables(piece, stats, (k, p) => t(k as TKey, p), lang));

  async function copyMethod() {
    try {
      await navigator.clipboard.writeText(method);
      app.notify(t('cap.copied'));
    } catch {
      app.notify(t('ex.copyFailed'));
    }
  }

  const cards = $derived([
    { label: t('stats.bars'), value: String(s.pieceBars), hint: s.gapBars > 0 ? t('stats.gap', { n: num(s.gapBars) }) : '' },
    { label: t('stats.keysCount'), value: String(s.distinctKeys), hint: '' },
    { label: t('stats.modulations'), value: String(s.modulations), hint: '' },
    {
      label: t('stats.farthest'),
      value: s.farthest ? t('stats.fifths', { n: s.maxDistance, unit: unitPlural(stats.measure, lang) }) : '–',
      hint: s.farthest ? `${keyDisplay(s.farthest.key, piece)} · ${t('common.bar')} ${pos(s.farthest.pos)}` : '',
    },
    { label: t('stats.meanDist'), value: num(s.meanDistance), hint: t('stats.fifthsUnit', { unit: unitPlural(stats.measure, lang) }) },
    { label: t('stats.home'), value: pct(s.homeShare), hint: t(`stats.homeHint.${stats.measure}` as TKey) },
    ...(exactHome ? [{ label: t('stats.exactHome'), value: pct(s.exactHomeShare), hint: keyDisplay(piece.meta.center, piece) }] : []),
    { label: t('stats.majorMinor'), value: `${pct(s.majorShare)} / ${pct(s.minorShare)}`, hint: '' },
    { label: t('stats.dominants'), value: String(s.dominantCount), hint: t('stats.dominantBars', { n: num(s.dominantBars) }) },
    {
      label: t('stats.longest'),
      value: s.longest ? num(s.longest.bars, 1) : '–',
      hint: s.longest ? keyDisplay(s.longest.key, piece) : '',
    },
  ]);
</script>

<div class="page">
  {#if piece.segments.length === 0}
    <div class="card empty">
      <p>{t('stats.empty')}</p>
      <div><button class="btn primary small" onclick={() => (app.tab = 'analysis')}>{t('stats.emptyGo')}</button></div>
    </div>
  {:else}
    <details class="card optbox" use:remember={'stats.options'}>
      <summary class="head"><span class="chev" aria-hidden="true"></span><h3>{t('stats.options')}</h3></summary>
      <div class="optbody">
        <label class="field">
          <span>{t('stats.measure')}</span>
          <select bind:value={piece.meta.distanceMeasure}>
            {#each DISTANCE_MEASURES as m (m)}<option value={m}>{t(`measure.${m}` as TKey)}</option>{/each}
          </select>
          <span class="hint">{t(`measure.${piece.meta.distanceMeasure}.help` as TKey)}</span>
        </label>
        <label class="check"><input type="checkbox" bind:checked={exactHome} />{t('stats.exactHomeOpt')}</label>
        {#if hasRepeats(piece)}
          <label class="check"><input type="checkbox" bind:checked={countRepeats} />{t('stats.countRepeats')}</label>
        {/if}
        <div class="field">
          <span>{t('cap.method')}</span>
          <p class="methodtext">{method}</p>
          <div class="line"><button class="btn small" onclick={copyMethod}>{t('stats.copy')}</button></div>
        </div>
      </div>
    </details>
    <section class="cards" aria-label={t('stats.summary')}>
      {#each cards as c (c.label)}
        <div class="card stat">
          <span class="label">{c.label}</span>
          <strong>{c.value}</strong>
          {#if c.hint}<span class="hint">{c.hint}</span>{/if}
        </div>
      {/each}
    </section>

    <ChartCard title={t('stats.keys')} chart={chartKeys(stats, piece, order)} name={`${base}-tonarten`}>
      {#snippet controls()}
        <select aria-label={t('stats.order')} bind:value={order}>
          <option value="duration">{t('stats.order.duration')}</option>
          <option value="fifths">{t('stats.order.fifths')}</option>
          <option value="first">{t('stats.order.first')}</option>
        </select>
      {/snippet}
      <DataTable columns={tables.keys.columns} rows={tables.keys.rows} name={`${base}-tonarten`} />
    </ChartCard>

    <ChartCard title={t('stats.distance')} chart={chartDistance(stats, piece)} name={`${base}-entfernung`}>
      <DataTable columns={tables.distance.columns} rows={tables.distance.rows} name={`${base}-entfernung`} />
    </ChartCard>

    <ChartCard title={t('stats.profile')} chart={chartProfile(stats, piece, signed)} name={`${base}-verlauf`}>
      {#snippet controls()}
        <label><input type="checkbox" bind:checked={signed} />{t('stats.signed')}</label>
      {/snippet}
      <h4>{t('stats.modTable')}</h4>
      <DataTable columns={tables.modulations.columns} rows={tables.modulations.rows} name={`${base}-modulationen`} />
      {#if tables.tonicizations.rows.length > 0}
        <h4>{t('stats.tonicizations')}</h4>
        <DataTable columns={tables.tonicizations.columns} rows={tables.tonicizations.rows} name={`${base}-tonikalisierungen`} />
      {/if}
    </ChartCard>

    <ChartCard title={t('stats.sections')} chart={chartSections(stats, piece)} name={`${base}-formteile`}>
      {#if stats.sections.length > 0}
        <DataTable columns={tables.sections.columns} rows={tables.sections.rows} name={`${base}-formteile`} />
      {:else}
        <p class="muted small">{t('stats.noSections')}</p>
      {/if}
    </ChartCard>
  {/if}
</div>

<style>
  .page { display: grid; gap: 16px; padding: 16px; max-width: 1100px; margin: 0 auto; }
  .empty { padding: 20px; display: grid; gap: 12px; }
  .empty p { margin: 0; }
  .cards { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
  @media (max-width: 700px) {
    .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .stat { padding: 10px 12px; }
    .stat strong { font-size: 1rem; }
    .page { padding: 12px; }
  }
  .stat { padding: 12px 14px; display: grid; gap: 2px; align-content: start; }
  .stat strong { font-size: 1.5rem; line-height: 1.2; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .optbody { padding: 0 14px 14px; display: grid; gap: 10px; }
  .check { display: flex; align-items: center; gap: 8px; }
  .methodtext { margin: 0; font-size: 0.9rem; }
  h4 { margin: 4px 0 0; font-size: 0.95rem; }
</style>
