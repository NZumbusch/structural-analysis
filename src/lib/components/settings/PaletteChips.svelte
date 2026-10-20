<script lang="ts">
  import { t, type TKey } from '../../i18n/index.svelte';
  import type { Piece } from '../../domain/types';
  import { activePalette, PALETTES } from '../../render/palettes';

  let { piece }: { piece: Piece } = $props();
  const active = $derived(activePalette(piece.style.colors));
</script>

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

<style>
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip {
    display: inline-flex; align-items: center; gap: 8px; padding: 5px 12px; border-radius: 99px;
    border: 1px solid var(--border); background: var(--surface); cursor: pointer;
  }
  .chip.on { border-color: var(--accent); background: var(--accent-soft); font-weight: 600; }
  .dots { display: inline-flex; gap: 3px; }
  .dots i { width: 14px; height: 10px; border-radius: 5px; border: 1.5px solid; display: block; }
</style>
