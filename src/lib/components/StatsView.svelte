<script lang="ts">
  import { chartDistance, chartKeys, chartProfile, chartSections, keyDisplay, type KeyOrder } from '../analysis/charts';
  import { formatNumber, formatPercent, type Column } from '../analysis/csv';
  import { computeStats, type DistanceStat, type KeyStat, type Modulation, type SectionStat } from '../analysis/stats';
  import { rowLabel } from '../domain/keys';
  import { hasRepeats, meterMap } from '../domain/structure';
  import { fileSlug } from '../domain/piece';
  import { formatPos } from '../domain/positions';
  import type { Piece } from '../domain/types';
  import { app } from '../stores/app.svelte';
  import { t } from '../i18n/index.svelte';
  import ChartCard from './ChartCard.svelte';
  import DataTable from './DataTable.svelte';

  let { piece }: { piece: Piece } = $props();

  let order = $state<KeyOrder>('duration');
  let signed = $state(false);
  let countRepeats = $state(false);

  const stats = $derived(computeStats(piece, { countRepeats }));
  const s = $derived(stats.summary);
  const lang = $derived(app.prefs.uiLang);
  const meter = $derived(meterMap(piece));
  const base = $derived(fileSlug(piece));

  const num = (n: number, digits = 2) => formatNumber(n, lang, digits);
  const pct = (n: number) => formatPercent(n, lang);
  const pos = (p: number) => formatPos(p, meter);
  const step = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
  const rowName = (r: number) => rowLabel(r, piece.style.noteNames, piece.style.enharmonic);

  const keyColumns = $derived<Column<KeyStat>[]>([
    { key: 'key', label: t('tbl.key'), value: (r) => keyDisplay(r.key, piece) },
    { key: 'row', label: t('tbl.row'), value: (r) => r.row, text: (r) => rowName(r.row) },
    { key: 'distance', label: t('tbl.distance'), value: (r) => r.distance, align: 'right' },
    { key: 'bars', label: t('tbl.bars'), value: (r) => r.bars, text: (r) => num(r.bars), align: 'right' },
    { key: 'share', label: t('tbl.share'), value: (r) => r.share, text: (r) => pct(r.share), align: 'right' },
    { key: 'dominant', label: t('tbl.dominantBars'), value: (r) => r.dominant, text: (r) => num(r.dominant), align: 'right' },
    { key: 'visits', label: t('tbl.visits'), value: (r) => r.visits, align: 'right' },
    { key: 'longest', label: t('tbl.longest'), value: (r) => r.longest, text: (r) => num(r.longest), align: 'right' },
    { key: 'first', label: t('tbl.first'), value: (r) => r.first, text: (r) => pos(r.first), align: 'right' },
  ]);

  const distanceColumns = $derived<Column<DistanceStat>[]>([
    { key: 'signed', label: t('tbl.distance'), value: (r) => r.signed, text: (r) => step(r.signed), align: 'right' },
    { key: 'row', label: t('tbl.row'), value: (r) => r.signed, text: (r) => rowName(stats.centerRow + r.signed) },
    { key: 'major', label: t('tbl.major'), value: (r) => r.major, text: (r) => num(r.major), align: 'right' },
    { key: 'minor', label: t('tbl.minor'), value: (r) => r.minor, text: (r) => num(r.minor), align: 'right' },
    { key: 'bars', label: t('tbl.bars'), value: (r) => r.bars, text: (r) => num(r.bars), align: 'right' },
    { key: 'share', label: t('tbl.share'), value: (r) => r.share, text: (r) => pct(r.share), align: 'right' },
  ]);

  const modColumns = $derived<Column<Modulation & { nr: number }>[]>([
    { key: 'nr', label: t('tbl.nr'), value: (r) => r.nr, align: 'right' },
    { key: 'pos', label: t('tbl.pos'), value: (r) => r.pos, text: (r) => pos(r.pos), align: 'right' },
    { key: 'from', label: t('tbl.fromKey'), value: (r) => keyDisplay(r.from, piece) },
    { key: 'to', label: t('tbl.toKey'), value: (r) => keyDisplay(r.to, piece) },
    { key: 'step', label: t('tbl.step'), value: (r) => r.step, text: (r) => step(r.step), align: 'right' },
    { key: 'after', label: t('tbl.distAfter'), value: (r) => r.distanceAfter, align: 'right' },
    { key: 'section', label: t('tbl.section'), value: (r) => r.section },
  ]);
  const modRows = $derived(stats.modulations.map((m, i) => ({ ...m, nr: i + 1 })));

  const sectionColumns = $derived<Column<SectionStat>[]>([
    { key: 'name', label: t('tbl.name'), value: (r) => r.name },
    { key: 'range', label: t('tbl.range'), value: (r) => r.from, text: (r) => `${pos(r.from)}–${pos(r.to)}` },
    { key: 'bars', label: t('tbl.analysed'), value: (r) => r.bars, text: (r) => num(r.bars), align: 'right' },
    { key: 'home', label: t('tbl.homeShare'), value: (r) => r.homeShare, text: (r) => pct(r.homeShare), align: 'right' },
    { key: 'mean', label: t('tbl.meanDist'), value: (r) => r.meanDistance, text: (r) => num(r.meanDistance), align: 'right' },
    { key: 'max', label: t('tbl.maxDist'), value: (r) => r.maxDistance, align: 'right' },
    { key: 'keys', label: t('tbl.keysN'), value: (r) => r.keys, align: 'right' },
  ]);

  const cards = $derived([
    { label: t('stats.bars'), value: String(s.pieceBars), hint: s.gapBars > 0 ? t('stats.gap', { n: num(s.gapBars) }) : '' },
    { label: t('stats.keysCount'), value: String(s.distinctKeys), hint: '' },
    { label: t('stats.modulations'), value: String(s.modulations), hint: '' },
    {
      label: t('stats.farthest'),
      value: s.farthest ? t('stats.fifths', { n: s.maxDistance }) : '–',
      hint: s.farthest ? `${keyDisplay(s.farthest.key, piece)} · ${t('common.bar')} ${pos(s.farthest.pos)}` : '',
    },
    { label: t('stats.meanDist'), value: num(s.meanDistance), hint: t('stats.fifthsUnit') },
    { label: t('stats.home'), value: pct(s.homeShare), hint: '' },
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
    <p class="card empty">{t('stats.empty')}</p>
  {:else}
    {#if hasRepeats(piece)}
      <label class="card opt"><input type="checkbox" bind:checked={countRepeats} />{t('stats.countRepeats')}</label>
    {/if}
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
      <DataTable columns={keyColumns} rows={stats.keys} name={`${base}-tonarten`} />
    </ChartCard>

    <ChartCard title={t('stats.distance')} chart={chartDistance(stats, piece)} name={`${base}-entfernung`}>
      <DataTable columns={distanceColumns} rows={stats.distances} name={`${base}-entfernung`} />
    </ChartCard>

    <ChartCard title={t('stats.profile')} chart={chartProfile(stats, piece, signed)} name={`${base}-verlauf`}>
      {#snippet controls()}
        <label><input type="checkbox" bind:checked={signed} />{t('stats.signed')}</label>
      {/snippet}
      <h4>{t('stats.modTable')}</h4>
      <DataTable columns={modColumns} rows={modRows} name={`${base}-modulationen`} />
    </ChartCard>

    <ChartCard title={t('stats.sections')} chart={chartSections(stats, piece)} name={`${base}-formteile`}>
      {#if stats.sections.length > 0}
        <DataTable columns={sectionColumns} rows={stats.sections} name={`${base}-formteile`} />
      {:else}
        <p class="muted small">{t('stats.noSections')}</p>
      {/if}
    </ChartCard>
  {/if}
</div>

<style>
  .page { display: grid; gap: 16px; padding: 16px; max-width: 1100px; margin: 0 auto; }
  .empty { padding: 20px; }
  .cards { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
  .stat { padding: 12px 14px; display: grid; gap: 2px; align-content: start; }
  .stat strong { font-size: 1.5rem; line-height: 1.2; font-variant-numeric: tabular-nums; }
  .opt { display: flex; align-items: center; gap: 8px; padding: 10px 14px; }
  h4 { margin: 4px 0 0; font-size: 0.95rem; }
</style>
