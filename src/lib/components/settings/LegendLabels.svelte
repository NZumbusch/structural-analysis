<script lang="ts">
  import { t, type TKey } from '../../i18n/index.svelte';
  import type { LegendKey, Piece } from '../../domain/types';
  import { CHART_LABELS } from '../../render/labels';

  let { piece }: { piece: Piece } = $props();
  const keys: LegendKey[] = ['major', 'minor', 'dominant', 'neapolitan', 'tonicization', 'passing'];
  const standard = $derived(CHART_LABELS[piece.style.language]);

  function set(key: LegendKey, value: string) {
    if (value.trim()) piece.style.legendLabels[key] = value;
    else delete piece.style.legendLabels[key];
  }
</script>

<div class="grid">
  {#each keys as k (k)}
    <label class="field">
      <span>{k === 'major' ? t('tbl.major') : k === 'minor' ? t('tbl.minor') : k === 'passing' ? t('an.passing') : t(`kind.${k}` as TKey)}</span>
      <input type="text" value={piece.style.legendLabels[k] ?? ''} placeholder={standard[k]} oninput={(e) => set(k, e.currentTarget.value)} />
    </label>
  {/each}
  <p class="hint">{t('set.leg.hint')}</p>
</div>

<style>
  .grid { display: grid; gap: 8px; }
  p { margin: 0; }
</style>
