<script lang="ts">
  import { newId } from '../../domain/ids';
  import type { Piece } from '../../domain/types';
  import { t } from '../../i18n/index.svelte';
  import KeyInput from '../KeyInput.svelte';
  import NumInput from '../NumInput.svelte';

  let { piece }: { piece: Piece } = $props();

  function add() {
    piece.annotations.push({ id: newId(), bar: 1, key: { ...piece.meta.center }, text: '', align: 'left' });
  }
</script>

<p class="hint">{t('an.annotationsHelp')}</p>
<div class="lines">
  {#each piece.annotations as a, i (i)}
    <div class="line">
      <div class="n"><NumInput label={t('common.bar')} value={a.bar} step={1} min={1} onchange={(v) => (a.bar = v ?? a.bar)} /></div>
      <div class="k"><KeyInput label={t('an.key')} value={a.key} names={piece.style.noteNames} onchange={(k) => (a.key = k)} /></div>
      <select class="sel" aria-label={t('an.side')} bind:value={a.align}>
        <option value="left">{t('common.right')} →</option>
        <option value="right">← {t('common.left')}</option>
      </select>
      <input class="grow" type="text" aria-label={t('common.text')} placeholder={t('common.text')} bind:value={a.text} />
      <button class="btn small icon danger" title={t('common.delete')} onclick={() => piece.annotations.splice(i, 1)}>×</button>
    </div>
  {/each}
</div>
<div class="line"><button class="btn" onclick={add}>{t('common.add')}</button></div>
