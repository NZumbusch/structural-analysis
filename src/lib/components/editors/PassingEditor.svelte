<script lang="ts">
  import { newId } from '../../domain/ids';
  import type { Piece } from '../../domain/types';
  import { t } from '../../i18n/index.svelte';
  import KeyInput from '../KeyInput.svelte';
  import NumInput from '../NumInput.svelte';

  let { piece }: { piece: Piece } = $props();

  function add() {
    const last = piece.passing[piece.passing.length - 1];
    piece.passing.push({ id: newId(), bar: last ? last.bar + 1 : 1, key: last ? { ...last.key } : { ...piece.meta.center } });
  }
</script>

<p class="hint">{t('an.passingHelp')}</p>
<div class="lines">
  {#each piece.passing as p, i (i)}
    <div class="line">
      <div class="n"><NumInput label={t('common.bar')} value={p.bar} step={1} min={1} onchange={(v) => (p.bar = v ?? p.bar)} /></div>
      <div class="k"><KeyInput label={t('an.key')} value={p.key} names={piece.style.noteNames} onchange={(k) => (p.key = k)} /></div>
      <button class="btn small icon danger" title={t('common.delete')} onclick={() => piece.passing.splice(i, 1)}>×</button>
    </div>
  {/each}
</div>
<div class="line"><button class="btn" onclick={add}>{t('common.add')}</button></div>
