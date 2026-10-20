<script lang="ts">
  import type { ExportPrefs } from '../../export/prefs';
  import { WIDTH_CHOICES } from '../../export/presets';
  import { t } from '../../i18n/index.svelte';
  import NumInput from '../NumInput.svelte';

  let { exp, simple = false }: { exp: ExportPrefs; simple?: boolean } = $props();
</script>

{#if !simple}
  <div class="seg" role="group" aria-label={t('ex.size')}>
    <button class="btn small" class:on={exp.mode === 'scale'} onclick={() => (exp.mode = 'scale')}>{t('ex.sizeScale')}</button>
    <button class="btn small" class:on={exp.mode === 'physical'} onclick={() => (exp.mode = 'physical')}>{t('ex.sizePhysical')}</button>
  </div>
{/if}
{#if exp.mode === 'physical' && !simple}
  <div class="chips">
    {#each WIDTH_CHOICES as w (w.cm)}
      <button class="chip" class:on={exp.widthCm === w.cm} onclick={() => (exp.widthCm = w.cm)}>{t(w.key)} · {String(w.cm).replace('.', ',')} cm</button>
    {/each}
  </div>
  <div class="field">
    <span>{t('ex.widthCm')}</span>
    <NumInput label={t('ex.widthCm')} min={2} max={200} step={0.5} value={exp.widthCm} onchange={(v) => (exp.widthCm = v ?? exp.widthCm)} />
  </div>
{/if}

<style>
  .seg { display: flex; gap: 6px; }
  .seg .btn { flex: 1; }
  .seg .on { background: var(--accent-soft); border-color: var(--accent); font-weight: 600; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { padding: 4px 10px; border-radius: 99px; border: 1px solid var(--border); background: var(--surface); cursor: pointer; font-size: 0.9rem; }
  .chip.on { border-color: var(--accent); background: var(--accent-soft); font-weight: 600; }
</style>
