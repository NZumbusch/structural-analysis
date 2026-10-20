<script lang="ts">
  import { t, type TKey } from '../../i18n/index.svelte';
  import type { Palette, Piece } from '../../domain/types';
  import { toCmyk } from '../../render/colors';

  let { piece, cmyk = false }: { piece: Piece; cmyk?: boolean } = $props();
  const keys: (keyof Palette)[] = [
    'majorFill', 'majorStroke', 'minorFill', 'minorStroke', 'text', 'muted',
    'grid', 'axis', 'link', 'sectionBand', 'centerBand', 'surface', 'background',
  ];
</script>

{#if !cmyk}
  <div class="colors">
    {#each keys as key (key)}
      <label class="color">
        <input type="color" bind:value={piece.style.colors[key]} />
        <span>{t(`col.${key}` as TKey)}</span>
      </label>
    {/each}
  </div>
{:else}
  <table>
    <tbody>
      {#each keys as key (key)}
        {@const c = toCmyk(piece.style.colors[key])}
        <tr>
          <td><i style:background={piece.style.colors[key]}></i></td>
          <td>{t(`col.${key}` as TKey)}</td>
          <td class="mono">{piece.style.colors[key].toUpperCase()}</td>
          <td class="mono">{c.c} / {c.m} / {c.y} / {c.k}</td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

<style>
  .colors { display: grid; gap: 8px 12px; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
  .color { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; }
  table { display: block; overflow-x: auto; border-collapse: collapse; width: 100%; font-size: 0.85rem; margin: 6px 0; }
  td { padding: 3px 6px 3px 0; white-space: nowrap; }
  i { display: block; width: 16px; height: 16px; border-radius: 4px; border: 1px solid var(--border); }
</style>
