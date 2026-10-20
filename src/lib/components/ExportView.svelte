<script lang="ts">
  import { fileSlug } from '../domain/piece';
  import { validate } from '../domain/validate';
  import type { Piece } from '../domain/types';
  import {
    chartSize, downloadBlob, pdfBlob, pngBlob, projectBlob, projectFileName, slugify, svgBlob, viewsZip, type FontMode,
  } from '../export/files';
  import { fitFontScale } from '../export/fit';
  import { LINK_WARN_LENGTH, shareLink } from '../export/share';
  import { FS } from '../render/chart';
  import { app } from '../stores/app.svelte';
  import { t } from '../i18n/index.svelte';
  import CaptionPanel from './CaptionPanel.svelte';
  import ChartPreview from './ChartPreview.svelte';
  import NumInput from './NumInput.svelte';
  import StylePanel from './StylePanel.svelte';

  let { piece }: { piece: Piece } = $props();

  let name = $state('');
  let mode = $state<'scale' | 'physical'>('scale');
  let scale = $state(3);
  let widthCm = $state(16);
  let dpi = $state(300);
  let busy = $state(false);
  let fonts = $state<FontMode>('embed');
  let zipKind = $state<'svg' | 'png' | 'pdf'>('svg');
  let targetPt = $state(8);
  let linkLength = $state(0);
  const problems = $derived(validate(piece).filter((i) => i.severity !== 'info').length);

  const view = $derived(piece.views.find((v) => v.id === app.activeViewId) ?? null);
  const range = $derived(view ? { from: view.from, to: view.to } : null);
  const size = $derived(chartSize(piece, range));
  const base = $derived(
    (name.trim() || fileSlug(piece)) + (view && !name.trim() ? `-${slugify(view.name) || 'ausschnitt'}` : ''),
  );

  const pixelWidth = $derived(mode === 'physical' ? Math.round((widthCm / 2.54) * dpi) : Math.round(size.width * scale));
  const pixelHeight = $derived(Math.round((pixelWidth * size.height) / size.width));
  /** Printed height of the row labels, so the chart can be sized for a column of a given width. */
  const labelPt = $derived(((FS.label * piece.style.fontScale * widthCm) / 2.54 / size.width) * 72);
  const cm = $derived(mode === 'physical' ? widthCm : undefined);

  const canCopy = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
  const canShareFile =
    typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] });

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

  const pngOptions = () => ({ view: range, ...(mode === 'physical' ? { pixelWidth } : { scale }) });

  const warnMissing = (n: number) => n > 0 && app.notify(t('ex.outlineMissing', { n }));
  const svg = () =>
    run(async () => {
      const { blob, missing } = await svgBlob(piece, { view: range, widthCm: cm, fonts });
      downloadBlob(blob, `${base}.svg`);
      warnMissing(missing);
    });
  const png = () => run(async () => downloadBlob(await pngBlob(piece, pngOptions()), `${base}.png`));
  const pdf = () =>
    run(async () => {
      const { blob, missing } = await pdfBlob(piece, { view: range, widthCm: cm, fonts });
      downloadBlob(blob, `${base}.pdf`);
      warnMissing(missing);
    });
  function fitText() {
    piece.style.fontScale = fitFontScale(piece, widthCm, targetPt, range);
    app.notify(t('ex.fitted', { pct: Math.round(piece.style.fontScale * 100) }));
  }
  const project = () => downloadBlob(projectBlob([piece]), name.trim() ? `${base}.tonart.json` : projectFileName(piece));
  const zipAll = () =>
    run(async () => {
      const blob = await viewsZip(piece, zipKind, name.trim() || fileSlug(piece), {
        widthCm: cm,
        fonts,
        ...(mode === 'physical' ? { pixelWidth } : { scale }),
      });
      downloadBlob(blob, `${name.trim() || fileSlug(piece)}-${zipKind}.zip`);
    });
  const copy = () =>
    run(async () => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob(piece, pngOptions()) })]);
        app.notify(t('ex.copied'));
      } catch {
        app.notify(t('ex.copyFailed'));
      }
    });
  const shareFile = () =>
    run(async () => {
      const blob = await pngBlob(piece, pngOptions());
      try {
        await navigator.share({ files: [new File([blob], `${base}.png`, { type: 'image/png' })], title: piece.meta.title });
      } catch {
        /* cancelled */
      }
    });
  const link = () =>
    run(async () => {
      const url = await shareLink(piece);
      linkLength = url.length;
      try {
        await navigator.clipboard.writeText(url);
        app.notify(url.length > LINK_WARN_LENGTH ? t('ex.linkLong') : t('ex.linkCopied'));
      } catch {
        app.notify(t('ex.copyFailed'));
      }
    });
</script>

<div class="layout">
  <section class="settings">
    <div class="card actions">
      <h2>{t('ex.heading')}</h2>
      <p class="muted small">{t('ex.current')}: <strong>{view ? view.name : t('view.whole')}</strong></p>
      {#if problems > 0}
        <p class="warn small">⚠ {t('val.exportWarn', { n: problems })} <button class="link" onclick={() => (app.tab = 'analysis')}>{t('val.review')}</button></p>
      {/if}
      <label class="field">
        <span>{t('ex.file')}</span>
        <input type="text" bind:value={name} placeholder={base} autocapitalize="off" autocomplete="off" spellcheck="false" />
      </label>

      <div class="seg" role="group" aria-label={t('ex.size')}>
        <button class="btn small" class:on={mode === 'scale'} onclick={() => (mode = 'scale')}>{t('ex.sizeScale')}</button>
        <button class="btn small" class:on={mode === 'physical'} onclick={() => (mode = 'physical')}>{t('ex.sizePhysical')}</button>
      </div>
      {#if mode === 'scale'}
        <label class="field">
          <span>{t('ex.pngScale')}</span>
          <select bind:value={scale}>
            {#each [1, 2, 3, 4, 6] as s (s)}<option value={s}>{s}×</option>{/each}
          </select>
        </label>
      {:else}
        <div class="two">
          <div class="field">
            <span>{t('ex.widthCm')}</span>
            <NumInput label={t('ex.widthCm')} min={2} max={200} step={0.5} value={widthCm} onchange={(v) => (widthCm = v ?? widthCm)} />
          </div>
          <label class="field">
            <span>{t('ex.dpi')}</span>
            <select bind:value={dpi}>
              {#each [150, 300, 600, 1200] as d (d)}<option value={d}>{d}</option>{/each}
            </select>
          </label>
        </div>
        <p class="hint">{t('ex.labelPt', { pt: labelPt.toFixed(1) })}</p>
        <div class="line">
          <label class="inline"><span class="muted small">{t('ex.targetPt')}</span>
            <span class="pt"><NumInput label={t('ex.targetPt')} min={4} max={24} step={0.5} value={targetPt} onchange={(v) => (targetPt = v ?? targetPt)} /></span>
          </label>
          <button class="btn small" onclick={fitText}>{t('ex.fit')}</button>
        </div>
      {/if}
      <p class="hint">{t('ex.pngSize', { w: pixelWidth, h: pixelHeight })}</p>

      <label class="field">
        <span>{t('ex.fonts')}</span>
        <select bind:value={fonts}>
          <option value="embed">{t('ex.fonts.embed')}</option>
          <option value="outline">{t('ex.fonts.outline')}</option>
          <option value="none">{t('ex.fonts.none')}</option>
        </select>
      </label>
      <div class="grid">
        <button class="btn primary" onclick={svg} disabled={busy}>SVG</button>
        <button class="btn primary" onclick={png} disabled={busy}>PNG</button>
        <button class="btn primary" onclick={pdf} disabled={busy}>PDF</button>
      </div>
      <p class="hint">{t('ex.svgHelp')} {t('ex.pdfHelp')}</p>

      <div class="line">
        {#if canCopy}<button class="btn" onclick={copy} disabled={busy}>{t('ex.copy')}</button>{/if}
        {#if canShareFile}<button class="btn" onclick={shareFile} disabled={busy}>{t('ex.share')}</button>{/if}
      </div>

      {#if piece.views.length > 0}
        <div class="line">
          <select class="zipkind" aria-label={t('ex.zipFormat')} bind:value={zipKind}>
            <option value="svg">SVG</option>
            <option value="png">PNG</option>
            <option value="pdf">PDF</option>
          </select>
          <button class="btn" onclick={zipAll} disabled={busy}>{t('ex.zipAll')}</button>
        </div>
        <p class="hint">{t('ex.zipHelp', { n: piece.views.length + 1 })}</p>
      {/if}
    </div>

    <div class="card actions">
      <h3>{t('ex.saveShare')}</h3>
      <button class="btn" onclick={project}>{t('ex.project')}</button>
      <p class="hint">{t('ex.projectHelp')}</p>
      <button class="btn" onclick={link} disabled={busy}>{t('ex.link')}</button>
      <p class="hint">
        {t('ex.linkHelp')}
        {#if linkLength}<br />{t('ex.linkLength', { n: linkLength })}{/if}
      </p>
    </div>

    <CaptionPanel {piece} />

    <h2 class="sub">{t('ex.settings')}</h2>
    <StylePanel {piece} />
  </section>

  <section class="side">
    <ChartPreview {piece} editable />
  </section>
</div>

<style>
  .layout {
    display: grid; gap: 16px; padding: 16px; max-width: 1600px; margin: 0 auto;
    grid-template-columns: minmax(320px, 460px) minmax(0, 1fr); align-items: start;
  }
  .settings { display: grid; gap: 12px; min-width: 0; }
  .actions { padding: 16px; display: grid; gap: 10px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .zipkind { width: auto; }
  .pt { display: inline-block; width: 90px; }
  .inline { display: inline-flex; align-items: center; gap: 8px; }
  .seg { display: flex; gap: 6px; }
  .seg .btn { flex: 1; }
  .seg .on { background: var(--accent-soft); border-color: var(--accent); font-weight: 600; }
  .sub { margin-top: 6px; }
  .warn { margin: 0; color: var(--danger); }
  .link { all: unset; cursor: pointer; text-decoration: underline; color: var(--accent); }
  .side { min-width: 0; position: sticky; top: calc(var(--header-h) + var(--tabs-h) + 12px); }
  @media (max-width: 960px) {
    .layout { grid-template-columns: minmax(0, 1fr); }
    .side { position: static; order: -1; }
  }
</style>
