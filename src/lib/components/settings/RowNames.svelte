<script lang="ts">
  import { rowLabel } from '../../domain/keys';
  import type { Piece } from '../../domain/types';
  import { renderChart } from '../../render/chart';
  import { t } from '../../i18n/index.svelte';

  let { piece }: { piece: Piece } = $props();
  const rows = $derived.by(() => {
    const g = renderChart(piece).geometry;
    const list: number[] = [];
    for (let r = g.topRow; r >= g.bottomRow; r--) list.push(r);
    return list;
  });

  function set(row: number, value: string) {
    if (value.trim()) piece.style.rowNames[String(row)] = value;
    else delete piece.style.rowNames[String(row)];
  }
</script>

<details>
  <summary class="light"><span class="chev" aria-hidden="true"></span>{t('st.rowNames')}</summary>
  <div class="names">
    {#each rows as r (r)}
      <label class="rn">
        <span class="muted small">{r > 0 ? `+${r}` : r}</span>
        <input type="text" value={piece.style.rowNames[String(r)] ?? ''} placeholder={rowLabel(r, piece.style.noteNames, piece.style.enharmonic)} oninput={(e) => set(r, e.currentTarget.value)} />
      </label>
    {/each}
  </div>
</details>

<style>
  .names { display: grid; gap: 6px; margin-top: 6px; }
  .rn { display: grid; grid-template-columns: 34px 1fr; gap: 8px; align-items: center; }
</style>
