<script lang="ts">
  import { cloneStyle, DEFAULT_STYLE } from '../domain/piece';
  import type { Palette, Piece, ShowOptions } from '../domain/types';
  import { activePalette, PALETTES } from '../render/palettes';
  import { app } from '../stores/app.svelte';
  import { t, type TKey } from '../i18n/index.svelte';
  import NumInput from './NumInput.svelte';
  import Panel from './Panel.svelte';

  let { piece }: { piece: Piece } = $props();

  const st = $derived(piece.style);
  const active = $derived(activePalette(st.colors));
  const colorKeys: (keyof Palette)[] = [
    'majorFill', 'majorStroke', 'minorFill', 'minorStroke', 'text', 'muted',
    'grid', 'axis', 'link', 'sectionBand', 'centerBand', 'surface', 'background',
  ];
  const showKeys = Object.keys(DEFAULT_STYLE.show) as (keyof ShowOptions)[];
  const tickSteps = [0, 1, 2, 4, 5, 8, 10, 16, 20, 25, 50, 100];

  function reset() {
    piece.style = cloneStyle(DEFAULT_STYLE);
  }

  function saveDefault() {
    app.saveDefaultStyle();
    app.notify(t('ex.defaultSaved'));
  }
</script>

<div class="stack">
  <Panel title={t('ex.colors')} open>
    <div class="chips">
      {#each PALETTES as p (p.id)}
        <button class="chip" class:on={active === p.id} onclick={() => (piece.style.colors = { ...p.colors })}>
          <span class="dots">
            <i style:background={p.colors.majorFill} style:border-color={p.colors.majorStroke}></i>
            <i style:background={p.colors.minorFill} style:border-color={p.colors.minorStroke}></i>
          </span>
          {t(`pal.${p.id}` as TKey)}
        </button>
      {/each}
      {#if active === null}<span class="chip on">{t('pal.custom')}</span>{/if}
    </div>
    <div class="colors">
      {#each colorKeys as key (key)}
        <label class="color">
          <input type="color" bind:value={piece.style.colors[key]} />
          <span>{t(`col.${key}` as TKey)}</span>
        </label>
      {/each}
    </div>
    <label class="check"><input type="checkbox" bind:checked={piece.style.transparentBackground} />{t('st.transparent')}</label>
  </Panel>

  <Panel title={t('ex.layout')}>
    <label class="field">
      <span>{t('st.barWidth')}: {st.barWidth}</span>
      <input type="range" min="2" max="24" step="0.5" bind:value={piece.style.barWidth} />
    </label>
    <label class="field">
      <span>{t('st.rowHeight')}: {st.rowHeight}</span>
      <input type="range" min="22" max="72" step="1" bind:value={piece.style.rowHeight} />
    </label>
    <label class="field">
      <span>{t('st.barHeight')}: {st.barHeight}</span>
      <input type="range" min="6" max="32" step="1" bind:value={piece.style.barHeight} />
    </label>
    <label class="field">
      <span>{t('st.fontScale')}: {Math.round(st.fontScale * 100)} %</span>
      <input type="range" min="0.7" max="1.8" step="0.05" bind:value={piece.style.fontScale} />
    </label>
    <label class="field">
      <span>{t('st.fontFamily')}</span>
      <select bind:value={piece.style.fontFamily}>
        <option value="sans">{t('st.font.sans')}</option>
        <option value="serif">{t('st.font.serif')}</option>
        <option value="mono">{t('st.font.mono')}</option>
      </select>
    </label>
    <div class="two">
      <label class="field">
        <span>{t('st.tickStep')}</span>
        <select bind:value={piece.style.tickStep}>
          {#each tickSteps as s (s)}
            <option value={s}>{s === 0 ? t('common.auto') : s}</option>
          {/each}
        </select>
      </label>
      <div class="field">
        <span>{t('st.extraRows')}</span>
        <NumInput label={t('st.extraRows')} min={0} max={6} value={st.extraRows} onchange={(v) => (piece.style.extraRows = v ?? 0)} />
      </div>
      <div class="field">
        <span>{t('st.rowMax')}</span>
        <NumInput label={t('st.rowMax')} nullable value={st.rowMax} placeholder={t('common.auto')} onchange={(v) => (piece.style.rowMax = v)} />
      </div>
      <div class="field">
        <span>{t('st.rowMin')}</span>
        <NumInput label={t('st.rowMin')} nullable value={st.rowMin} placeholder={t('common.auto')} onchange={(v) => (piece.style.rowMin = v)} />
      </div>
    </div>
    <p class="hint">{t('st.rowRangeHint')}</p>
  </Panel>

  <Panel title={t('ex.labels')}>
    <label class="field">
      <span>{t('st.language')}</span>
      <select bind:value={piece.style.language}>
        <option value="de">Deutsch</option>
        <option value="en">English</option>
      </select>
    </label>
    <label class="field">
      <span>{t('st.noteNames')}</span>
      <select bind:value={piece.style.noteNames}>
        <option value="de">{t('st.names.de')}</option>
        <option value="en">{t('st.names.en')}</option>
      </select>
    </label>
    <label class="field">
      <span>{t('st.titleLayout')}</span>
      <select bind:value={piece.style.titleLayout}>
        <option value="composer-title">{t('st.layout.composer-title')}</option>
        <option value="title-composer">{t('st.layout.title-composer')}</option>
        <option value="title">{t('st.layout.title')}</option>
      </select>
    </label>
    <label class="check"><input type="checkbox" bind:checked={piece.style.showYear} />{t('st.showYear')}</label>
  </Panel>

  <Panel title={t('ex.elements')}>
    <div class="shows">
      {#each showKeys as key (key)}
        <label class="check"><input type="checkbox" bind:checked={piece.style.show[key]} />{t(`show.${key}` as TKey)}</label>
      {/each}
    </div>
  </Panel>

  <div class="line">
    <button class="btn" onclick={saveDefault}>{t('ex.saveDefault')}</button>
    <button class="btn" onclick={reset}>{t('ex.resetStyle')}</button>
  </div>
</div>

<style>
  .stack { display: grid; gap: 12px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip {
    display: inline-flex; align-items: center; gap: 8px; padding: 5px 12px; border-radius: 99px;
    border: 1px solid var(--border); background: var(--surface); cursor: pointer;
  }
  .chip.on { border-color: var(--accent); background: var(--accent-soft); font-weight: 600; }
  .dots { display: inline-flex; gap: 3px; }
  .dots i { width: 14px; height: 10px; border-radius: 5px; border: 1.5px solid; display: block; }
  .colors { display: grid; gap: 8px 12px; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
  .color { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; }
  .check { display: flex; align-items: center; gap: 8px; font-size: 0.95rem; }
  .shows { display: grid; gap: 8px 12px; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
</style>
