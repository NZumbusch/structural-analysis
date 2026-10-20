<script lang="ts">
  import { t } from '../../i18n/index.svelte';
  import type { Piece } from '../../domain/types';

  let { piece }: { piece: Piece } = $props();
  const st = $derived(piece.style);
</script>

<div class="field">
  <span>{t('st.barWidth')}: {st.barWidth > 0 ? st.barWidth : t('common.auto')}</span>
  <div class="line">
    <label class="check"><input type="checkbox" checked={st.barWidth === 0} onchange={(e) => (piece.style.barWidth = e.currentTarget.checked ? 0 : 6)} />{t('common.auto')}</label>
    {#if st.barWidth > 0}<input type="range" min="2" max="24" step="0.5" bind:value={piece.style.barWidth} />{/if}
  </div>
</div>

<style>
  .check { display: flex; align-items: center; gap: 8px; font-size: 0.95rem; }
</style>
