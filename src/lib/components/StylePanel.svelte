<script lang="ts">
  import { cloneStyle, DEFAULT_STYLE } from '../domain/piece';
  import { rowLabel } from '../domain/keys';
  import { renderChart } from '../render/chart';
  import { toCmyk } from '../render/colors';
  import type { Palette, Piece, ShowOptions } from '../domain/types';
  import { activePalette, PALETTES } from '../render/palettes';
  import { app } from '../stores/app.svelte';
  import { t, type TKey } from '../i18n/index.svelte';
  import NumInput from './NumInput.svelte';
  import Panel from './Panel.svelte';

  let { piece, simple = false }: { piece: Piece; simple?: boolean } = $props();

  const st = $derived(piece.style);
  const active = $derived(activePalette(st.colors));
  const colorKeys: (keyof Palette)[] = [
    'majorFill', 'majorStroke', 'minorFill', 'minorStroke', 'text', 'muted',
    'grid', 'axis', 'link', 'sectionBand', 'centerBand', 'surface', 'background',
  ];
  const showKeys = Object.keys(DEFAULT_STYLE.show) as (keyof ShowOptions)[];
  const tickSteps = [0, 1, 2, 4, 5, 8, 10, 16, 20, 25, 50, 100];

  /** The rows of the whole chart, for the manual label overrides. */
  const rowList = $derived.by(() => {
    const g = renderChart(piece).geometry;
    const rows: number[] = [];
    for (let r = g.topRow; r >= g.bottomRow; r--) rows.push(r);
    return rows;
  });

  function setRowName(row: number, value: string) {
    if (value.trim()) piece.style.rowNames[String(row)] = value;
    else delete piece.style.rowNames[String(row)];
  }

  function reset() {
    piece.style = cloneStyle(DEFAULT_STYLE);
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
    <label class="check"><input type="checkbox" bind:checked={piece.style.hatch} />{t('st.hatch')}</label>
    <details class="cmyk">
      <summary class="light"><span class="chev" aria-hidden="true"></span>{t('st.cmyk')}</summary>
      <table>
        <tbody>
          {#each colorKeys as key (key)}
            {@const c = toCmyk(st.colors[key])}
            <tr>
              <td><i style:background={st.colors[key]}></i></td>
              <td>{t(`col.${key}` as TKey)}</td>
              <td class="mono">{st.colors[key].toUpperCase()}</td>
              <td class="mono">{c.c} / {c.m} / {c.y} / {c.k}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="hint">{t('st.cmykHint')}</p>
    </details>
  </Panel>

  {#if !simple}
  <Panel title={t('ex.layout')}>
    <div class="field">
      <span>{t('st.barWidth')}: {st.barWidth > 0 ? st.barWidth : t('common.auto')}</span>
      <div class="line">
        <label class="check"><input type="checkbox" checked={st.barWidth === 0} onchange={(e) => (piece.style.barWidth = e.currentTarget.checked ? 0 : 6)} />{t('common.auto')}</label>
        {#if st.barWidth > 0}<input type="range" min="2" max="24" step="0.5" bind:value={piece.style.barWidth} />{/if}
      </div>
    </div>
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
    <label class="field">
      <span>{t('st.detailWidth')}: {st.detailWidth}</span>
      <input type="range" min="300" max="1600" step="20" bind:value={piece.style.detailWidth} />
    </label>
    <div class="two">
      <label class="field">
        <span>{t('st.barLines')}</span>
        <select bind:value={piece.style.barLines}>
          <option value="auto">{t('common.auto')}</option>
          <option value="on">{t('common.on')}</option>
          <option value="off">{t('common.off')}</option>
        </select>
      </label>
      <label class="field">
        <span>{t('st.beatTicks')}</span>
        <select bind:value={piece.style.beatTicks}>
          <option value="auto">{t('common.auto')}</option>
          <option value="on">{t('common.on')}</option>
          <option value="off">{t('common.off')}</option>
        </select>
      </label>
    </div>
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
      <span>{t('st.titleLayout')}</span>
      <select bind:value={piece.style.titleLayout}>
        <option value="composer-title">{t('st.layout.composer-title')}</option>
        <option value="title-composer">{t('st.layout.title-composer')}</option>
        <option value="title">{t('st.layout.title')}</option>
      </select>
    </label>
    <label class="check"><input type="checkbox" bind:checked={piece.style.showYear} />{t('st.showYear')}</label>
    <label class="field">
      <span>{t('setup.repeatDisplay')}</span>
      <select bind:value={piece.style.repeatDisplay}>
        <option value="symbols">{t('setup.repeat.symbols')}</option>
        <option value="expanded">{t('setup.repeat.expanded')}</option>
      </select>
    </label>
    <label class="field">
      <span>{t('st.enharmonic')}</span>
      <select bind:value={piece.style.enharmonic}>
        <option value="auto">{t('common.auto')}</option>
        <option value="flats">{t('st.enh.flats')}</option>
        <option value="sharps">{t('st.enh.sharps')}</option>
      </select>
      <span class="hint">{t('st.enharmonicHint')}</span>
    </label>
    <details class="rowsdetails">
      <summary class="light"><span class="chev" aria-hidden="true"></span>{t('st.rowNames')}</summary>
      <div class="rownames">
        {#each rowList as r (r)}
          <label class="rn">
            <span class="muted small">{r > 0 ? `+${r}` : r}</span>
            <input
              type="text"
              value={piece.style.rowNames[String(r)] ?? ''}
              placeholder={rowLabel(r, st.noteNames, st.enharmonic)}
              oninput={(e) => setRowName(r, e.currentTarget.value)}
            />
          </label>
        {/each}
      </div>
    </details>
  </Panel>

  <Panel title={t('ex.elements')}>
    <div class="shows">
      {#each showKeys as key (key)}
        <label class="check"><input type="checkbox" bind:checked={piece.style.show[key]} />{t(`show.${key}` as TKey)}</label>
      {/each}
    </div>
  </Panel>

  {/if}

  <div class="line">
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
  .cmyk table { display: block; overflow-x: auto; border-collapse: collapse; width: 100%; font-size: 0.85rem; margin: 6px 0; }
  .cmyk td { padding: 3px 6px 3px 0; white-space: nowrap; }
  .cmyk i { display: block; width: 16px; height: 16px; border-radius: 4px; border: 1px solid var(--border); }
  .rownames { display: grid; gap: 6px; margin-top: 6px; }
  .rn { display: grid; grid-template-columns: 34px 1fr; gap: 8px; align-items: center; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
</style>
