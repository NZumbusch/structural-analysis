<script lang="ts">
  import { fileSlug } from '../domain/piece';
  import type { Piece } from '../domain/types';
  import { downloadBlob, pngBlob, projectBlob, projectFileName, svgBlob } from '../export/files';
  import { renderChart } from '../render/chart';
  import { app } from '../stores/app.svelte';
  import { t } from '../i18n/index.svelte';
  import ChartPreview from './ChartPreview.svelte';
  import StylePanel from './StylePanel.svelte';

  let { piece }: { piece: Piece } = $props();

  let name = $state('');
  let scale = $state(3);
  let busy = $state(false);

  const base = $derived(name.trim() || fileSlug(piece));
  const size = $derived(renderChart(piece));
  const canCopy = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;

  async function run(task: () => Promise<void>) {
    busy = true;
    try {
      await task();
    } catch {
      app.notify(t('ex.failed'));
    } finally {
      busy = false;
    }
  }

  const svg = () => downloadBlob(svgBlob(piece), `${base}.svg`);
  const png = () => run(async () => downloadBlob(await pngBlob(piece, scale), `${base}.png`));
  const project = () => downloadBlob(projectBlob([piece]), name.trim() ? `${base}.tonart.json` : projectFileName(piece));
  const copy = () =>
    run(async () => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob(piece, scale) })]);
        app.notify(t('ex.copied'));
      } catch {
        app.notify(t('ex.copyFailed'));
      }
    });
</script>

<div class="layout">
  <section class="settings">
    <div class="card actions">
      <h2>{t('ex.heading')}</h2>
      <label class="field">
        <span>{t('ex.file')}</span>
        <input type="text" bind:value={name} placeholder={fileSlug(piece)} autocapitalize="off" autocomplete="off" spellcheck="false" />
      </label>
      <div class="grid">
        <button class="btn primary" onclick={svg}>{t('ex.svg')}</button>
        <button class="btn primary" onclick={png} disabled={busy}>{t('ex.png')}</button>
      </div>
      <div class="line">
        <label class="field res">
          <span>{t('ex.pngScale')}</span>
          <select bind:value={scale}>
            {#each [1, 2, 3, 4, 6] as s (s)}
              <option value={s}>{s}× · {t('ex.pngSize', { w: Math.round(size.width * s), h: Math.round(size.height * s) })}</option>
            {/each}
          </select>
        </label>
        {#if canCopy}<button class="btn" onclick={copy} disabled={busy}>{t('ex.copy')}</button>{/if}
      </div>
      <p class="hint">{t('ex.svgHelp')}</p>
      <button class="btn" onclick={project}>{t('ex.project')}</button>
      <p class="hint">{t('ex.projectHelp')}</p>
    </div>

    <h2 class="sub">{t('ex.settings')}</h2>
    <StylePanel {piece} />
  </section>

  <section class="side">
    <ChartPreview {piece} />
  </section>
</div>

<style>
  .layout {
    display: grid; gap: 16px; padding: 16px; max-width: 1600px; margin: 0 auto;
    grid-template-columns: minmax(320px, 460px) minmax(0, 1fr); align-items: start;
  }
  .settings { display: grid; gap: 12px; min-width: 0; }
  .actions { padding: 16px; display: grid; gap: 10px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .res { flex: 1 1 200px; }
  .sub { margin-top: 6px; }
  .side { min-width: 0; position: sticky; top: calc(var(--header-h) + var(--tabs-h) + 12px); }
  @media (max-width: 960px) {
    .layout { grid-template-columns: minmax(0, 1fr); }
    .side { position: static; order: -1; }
  }
</style>
