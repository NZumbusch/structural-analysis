<script lang="ts">
  import { fileSlug } from '../domain/piece';
  import { validate } from '../domain/validate';
  import type { Piece } from '../domain/types';
  import {
    chartSize, downloadBlob, pdfBlob, pngBlob, slugify, svgBlob, viewsZip,
  } from '../export/files';
  import { defaultExportPrefs } from '../export/prefs';
  import { LINK_WARN_LENGTH, shareLink } from '../export/share';
  import { app } from '../stores/app.svelte';
  import { formatNumber } from '../analysis/csv';
  import { t } from '../i18n/index.svelte';
  import CaptionPanel from './CaptionPanel.svelte';
  import DataExportPanel from './DataExportPanel.svelte';
  import ChartPreview from './ChartPreview.svelte';
  import SettingsPanel from './settings/SettingsPanel.svelte';
  import SimpleNote from './SimpleNote.svelte';

  let { piece }: { piece: Piece } = $props();

  let name = $state('');
  const exp = $state(defaultExportPrefs());
  let busy = $state(false);
  let zipKind = $state<'svg' | 'png' | 'pdf'>('svg');
  let linkLength = $state(0);
  const problems = $derived(validate(piece).filter((i) => i.severity !== 'info').length);

  const view = $derived(piece.views.find((v) => v.id === app.activeViewId) ?? null);
  const range = $derived(view ? { from: view.from, to: view.to } : null);
  const size = $derived(chartSize(piece, range));
  const base = $derived(
    (name.trim() || fileSlug(piece)) + (view && !name.trim() ? `-${slugify(view.name) || 'ausschnitt'}` : ''),
  );

  const physical = $derived(exp.mode === 'physical' && !app.simple);
  const pixelWidth = $derived(physical ? Math.round((exp.widthCm / 2.54) * exp.dpi) : Math.round(size.width * exp.scale));
  const pixelHeight = $derived(Math.round((pixelWidth * size.height) / size.width));
  const heightCm = $derived((size.height * exp.widthCm) / size.width);
  const cm = $derived(physical ? exp.widthCm : undefined);

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

  const pngOptions = () => ({ view: range, stamp: exp.stamp, ...(physical ? { pixelWidth } : { scale: exp.scale }) });

  const warnMissing = (n: number) => n > 0 && app.notify(t('ex.outlineMissing', { n }));
  const svg = () =>
    run(async () => {
      const { blob, missing } = await svgBlob(piece, { view: range, widthCm: cm, fonts: exp.fonts, stamp: exp.stamp });
      downloadBlob(blob, `${base}.svg`);
      warnMissing(missing);
    });
  const png = () => run(async () => downloadBlob(await pngBlob(piece, pngOptions()), `${base}.png`));
  const pdf = () =>
    run(async () => {
      const { blob, missing } = await pdfBlob(piece, { view: range, widthCm: cm, fonts: exp.fonts, stamp: exp.stamp });
      downloadBlob(blob, `${base}.pdf`);
      warnMissing(missing);
    });
  const project = () => app.saveProjectFile([piece], name.trim() ? `${base}.tonart.json` : undefined);
  const zipAll = () =>
    run(async () => {
      const blob = await viewsZip(piece, zipKind, name.trim() || fileSlug(piece), {
        widthCm: cm,
        fonts: exp.fonts,
        stamp: exp.stamp,
        ...(physical ? { pixelWidth } : { scale: exp.scale }),
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
    <SimpleNote />
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
      <div class="grid">
        <button class="btn primary" onclick={svg} disabled={busy}>SVG</button>
        <button class="btn primary" onclick={png} disabled={busy}>PNG</button>
        <button class="btn primary" onclick={pdf} disabled={busy}>PDF</button>
      </div>
      <p class="hint">
        {#if physical}{t('set.fit.size', { w: formatNumber(exp.widthCm, app.prefs.uiLang, 1), h: formatNumber(heightCm, app.prefs.uiLang, 1) })} · {/if}{t('ex.pngSize', { w: pixelWidth, h: pixelHeight })}
      </p>
      <p class="hint">{t('ex.svgHelp')} {t('ex.pdfHelp')}</p>

      <div class="line">
        {#if canCopy}<button class="btn" onclick={copy} disabled={busy}>{t('ex.copy')}</button>{/if}
        {#if canShareFile}<button class="btn" onclick={shareFile} disabled={busy}>{t('ex.share')}</button>{/if}
      </div>

      {#if piece.views.length > 0 && !app.simple}
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

    <h2 class="sub">{t('set.g.print')}</h2>
    <SettingsPanel {piece} {exp} {range} groups={['print']} simple={app.simple} />

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

    {#if !app.simple}
      <CaptionPanel {piece} />
      <DataExportPanel {piece} />
    {/if}
  </section>

  <section class="side">
    <ChartPreview {piece} jump />
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
  .zipkind { width: auto; }
  .sub { margin-top: 6px; }
  .warn { margin: 0; color: var(--danger); }
  .link { all: unset; cursor: pointer; text-decoration: underline; color: var(--accent); }
  .side { min-width: 0; position: sticky; top: calc(var(--header-h) + var(--tabs-h) + 12px); }
  @media (max-width: 960px) {
    .layout { grid-template-columns: minmax(0, 1fr); }
    .side { position: static; order: -1; }
  }
</style>
