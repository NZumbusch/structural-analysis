<script lang="ts">
  import { newId } from '../../domain/ids';
  import type { Piece } from '../../domain/types';
  import { t } from '../../i18n/index.svelte';
  import NumInput from '../NumInput.svelte';

  let { piece }: { piece: Piece } = $props();

  const COLORS = ['#F2B84B', '#E5737B', '#5B9BD5', '#7BC47F', '#B48AD6'];

  function add() {
    const n = piece.highlights.length;
    piece.highlights.push({ id: newId(), from: 1, to: 4, label: '', color: COLORS[n % COLORS.length] });
  }
</script>

<p class="hint">{t('an.highlightsHelp')}</p>
<div class="lines">
  {#each piece.highlights as h, i (i)}
    <div class="line">
      <div class="n"><NumInput label={t('an.from')} value={h.from} step={1} min={1} onchange={(v) => (h.from = v ?? h.from)} /></div>
      <div class="n"><NumInput label={t('an.to')} value={h.to} step={1} min={1} onchange={(v) => (h.to = v ?? h.to)} /></div>
      <input type="color" aria-label={t('common.color')} bind:value={h.color} />
      <input class="grow" type="text" aria-label={t('an.label')} placeholder={t('an.label')} bind:value={h.label} />
      <button class="btn small icon danger" title={t('common.delete')} onclick={() => piece.highlights.splice(i, 1)}>×</button>
    </div>
  {/each}
</div>
<div class="line"><button class="btn" onclick={add}>{t('common.add')}</button></div>
