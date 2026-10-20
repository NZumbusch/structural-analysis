<script lang="ts">
  import type { Piece } from '../../domain/types';
  import { fitFontScale, fitRowHeight, labelPoints } from '../../export/fit';
  import type { ExportPrefs } from '../../export/prefs';
  import { renderChart, type ViewRange } from '../../render/chart';
  import { t } from '../../i18n/index.svelte';
  import { app } from '../../stores/app.svelte';
  import NumInput from '../NumInput.svelte';

  let { piece, exp, range }: { piece: Piece; exp: ExportPrefs; range: ViewRange | null } = $props();

  let targetCm = $state(10);
  const chart = $derived(renderChart(piece, { view: range }));
  const heightCm = $derived((chart.height * exp.widthCm) / chart.width);
  const pt = $derived(labelPoints(piece, exp.widthCm, range));

  function fitText() {
    piece.style.fontScale = fitFontScale(piece, exp.widthCm, exp.targetPt, range);
    app.notify(t('ex.fitted', { pct: Math.round(piece.style.fontScale * 100) }));
  }
  function fitHeight() {
    piece.style.rowHeight = fitRowHeight(piece, exp.widthCm, targetCm, range);
    app.notify(t('set.fit.heightDone', { n: piece.style.rowHeight }));
  }
</script>

<p class="facts">
  <strong>{t('set.fit.size', { w: String(Math.round(exp.widthCm * 10) / 10), h: String(Math.round(heightCm * 10) / 10) })}</strong><br />
  {t('set.fit.pt', { pt: pt.toFixed(1) })}
</p>
<div class="line">
  <label class="inline"><span class="muted small">{t('ex.targetPt')}</span>
    <span class="pt"><NumInput label={t('ex.targetPt')} min={4} max={24} step={0.5} value={exp.targetPt} onchange={(v) => (exp.targetPt = v ?? exp.targetPt)} /></span>
  </label>
  <button class="btn small" onclick={fitText}>{t('ex.fit')}</button>
</div>
<div class="line">
  <label class="inline"><span class="muted small">{t('set.fit.height')}</span>
    <span class="pt"><NumInput label={t('set.fit.height')} min={2} max={80} step={0.5} value={targetCm} onchange={(v) => (targetCm = v ?? targetCm)} /></span>
  </label>
  <button class="btn small" onclick={fitHeight}>{t('set.fit.heightBtn')}</button>
</div>

<style>
  .facts { margin: 0; font-size: 0.9rem; }
  .pt { display: inline-block; width: 90px; }
  .inline { display: inline-flex; align-items: center; gap: 8px; }
</style>
