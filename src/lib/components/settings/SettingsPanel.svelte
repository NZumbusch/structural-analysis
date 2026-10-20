<script lang="ts">
  import { cloneStyle, DEFAULT_STYLE } from '../../domain/piece';
  import type { Piece } from '../../domain/types';
  import type { ExportPrefs } from '../../export/prefs';
  import type { ViewRange } from '../../render/chart';
  import { GROUPS, searchSettings, SETTINGS, type GroupId, type Setting } from '../../settings/registry';
  import { t } from '../../i18n/index.svelte';
  import BarWidth from './BarWidth.svelte';
  import ChecksBlock from './ChecksBlock.svelte';
  import ColorGrid from './ColorGrid.svelte';
  import ControlRow from './ControlRow.svelte';
  import FitBlock from './FitBlock.svelte';
  import LegendLabels from './LegendLabels.svelte';
  import PaletteChips from './PaletteChips.svelte';
  import PresetsBlock from './PresetsBlock.svelte';
  import RowNames from './RowNames.svelte';
  import WidthsBlock from './WidthsBlock.svelte';

  let { piece, exp, range, simple = false }: { piece: Piece; exp: ExportPrefs; range: ViewRange | null; simple?: boolean } = $props();

  /** Blocks that carry their own label. */
  const NO_HEADING = ['rowNames', 'barWidth', 'cmyk'];
  const KEY = 'tonartenverlauf.exportGroup';
  const remembered = (() => {
    try {
      const v = localStorage.getItem(KEY);
      return GROUPS.some((g) => g.id === v) ? (v as GroupId) : 'print';
    } catch {
      return 'print';
    }
  })();
  let group = $state<GroupId>(remembered);
  let query = $state('');

  function pick(id: GroupId) {
    group = id;
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* not remembered */
    }
  }

  const roots = $derived({ style: piece.style, export: exp });
  const searching = $derived(query.trim().length > 0);
  const allowed = (s: Setting) => !simple || !s.advanced;
  const found = $derived(
    searching
      ? searchSettings(query, (k) => t(k), SETTINGS).filter(allowed)
      : SETTINGS.filter((s) => s.group === group && allowed(s) && (!s.when || s.when === exp.mode)),
  );
  // browsing shows the everyday settings; the rest sits behind one disclosure (searching shows everything that matches)
  const basics = $derived(searching ? found : found.filter((s) => !s.advanced));
  const more = $derived(searching ? [] : found.filter((s) => s.advanced));
  const groupLabel = (id: GroupId) => t(GROUPS.find((g) => g.id === id)!.label);
  const reset = () => (piece.style = cloneStyle(DEFAULT_STYLE));
</script>

<div class="panel card">
  <div class="search">
    <input
      type="search"
      placeholder={t('set.search')}
      aria-label={t('set.search')}
      bind:value={query}
      onkeydown={(e) => e.key === 'Escape' && (query = '')}
      autocapitalize="off"
      autocomplete="off"
      spellcheck="false"
    />
  </div>

  {#if !searching}
    <div class="tabs" role="tablist" aria-label={t('ex.settings')}>
      {#each GROUPS as g (g.id)}
        <button role="tab" class="tab" class:on={group === g.id} aria-selected={group === g.id} onclick={() => pick(g.id)}>{t(g.label)}</button>
      {/each}
    </div>
  {/if}

  {#snippet row(s: Setting)}
    {@const c = s.control}
    <section class="row" data-setting={s.id}>
      {#if searching}<span class="badge">{groupLabel(s.group)}</span>{/if}
      {#if c.type === 'custom'}
        {#if !NO_HEADING.includes(c.id)}<h4>{t(s.label)}</h4>{/if}
        {#if c.id === 'presets'}<PresetsBlock {piece} {exp} {range} />
        {:else if c.id === 'widths'}<WidthsBlock {exp} {simple} />
        {:else if c.id === 'fit'}<FitBlock {piece} {exp} {range} />
        {:else if c.id === 'checks'}<ChecksBlock {piece} {exp} {range} />
        {:else if c.id === 'palette'}<PaletteChips {piece} />
        {:else if c.id === 'colors'}
          <details><summary class="light"><span class="chev" aria-hidden="true"></span>{t('set.s.colorsEach')}</summary><ColorGrid {piece} /></details>
        {:else if c.id === 'cmyk'}
          <details><summary class="light"><span class="chev" aria-hidden="true"></span>{t('st.cmyk')}</summary><ColorGrid {piece} cmyk /><p class="hint">{t('st.cmykHint')}</p></details>
        {:else if c.id === 'rowNames'}<RowNames {piece} />
        {:else if c.id === 'legendLabels'}<LegendLabels {piece} />
        {:else if c.id === 'barWidth'}<BarWidth {piece} />
        {/if}
      {:else}
        <ControlRow setting={s} {roots} />
      {/if}
    </section>
  {/snippet}

  <div class="list">
    {#each basics as s (s.id)}{@render row(s)}{/each}
    {#if more.length > 0}
      <details class="more">
        <summary class="light"><span class="chev" aria-hidden="true"></span>{t('set.more', { n: more.length })}</summary>
        <div class="list inner">
          {#each more as s (s.id)}{@render row(s)}{/each}
        </div>
      </details>
    {/if}
    {#if basics.length === 0 && more.length === 0}
      <p class="muted">{t('set.none')}</p>
    {/if}
  </div>

  <div class="foot"><button class="btn small" onclick={reset}>{t('ex.resetStyle')}</button></div>
</div>

<style>
  .panel { display: grid; gap: 10px; padding: 12px; min-width: 0; }
  .search input { width: 100%; }
  .tabs { display: flex; flex-wrap: wrap; gap: 4px; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
  .tab { padding: 5px 12px; border-radius: 8px 8px 0 0; border: 1px solid transparent; background: transparent; cursor: pointer; color: var(--muted); }
  .tab:hover { color: var(--text); }
  .tab.on { color: var(--text); background: var(--accent-soft); border-color: var(--accent); font-weight: 600; }
  .list { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
  .row { display: grid; gap: 6px; grid-template-columns: minmax(0, 1fr); padding-bottom: 12px; border-bottom: 1px solid var(--border); }
  .row:last-child { border-bottom: 0; padding-bottom: 0; }
  h4 { margin: 0; font-size: 0.95rem; }
  .badge { justify-self: start; font-size: 0.72rem; color: var(--muted); background: var(--surface-2); border: 1px solid var(--border); border-radius: 99px; padding: 0 8px; }
  p { margin: 0; }
  .foot { display: flex; }
  .more { border-top: 1px solid var(--border); padding-top: 10px; }
  .more > summary { margin-bottom: 10px; }
  .inner { margin-top: 4px; }
</style>
