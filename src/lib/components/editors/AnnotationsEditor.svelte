<script lang="ts">
  import { newId } from '../../domain/ids';
  import type { Piece } from '../../domain/types';
  import { t } from '../../i18n/index.svelte';
  import { app } from '../../stores/app.svelte';
  import KeyInput from '../KeyInput.svelte';
  import PosInput from '../PosInput.svelte';

  let { piece }: { piece: Piece } = $props();

  function add() {
    piece.annotations.push({
      id: newId(), pos: 1, key: { ...piece.meta.center }, text: '', align: 'left', dx: 0, dy: 0, hidden: false,
    });
  }
</script>

<p class="hint">{t('an.annotationsHelp')}</p>
<div class="lines">
  {#each piece.annotations as a, i (i)}
    <div
      class="line"
      class:selected={app.selection?.id === a.id}
      data-row-id={a.id}
      onfocusin={() => (app.selection = { kind: 'annotation', id: a.id })}
    >
      <div class="n"><PosInput label={t('common.bar')} value={a.pos} meter={piece.meta.meter} onchange={(v) => (a.pos = v)} /></div>
      <div class="k"><KeyInput label={t('an.key')} value={a.key} names={piece.style.noteNames} onchange={(k) => (a.key = k)} /></div>
      <select class="sel" aria-label={t('an.side')} bind:value={a.align}>
        <option value="left">{t('common.right')} →</option>
        <option value="right">← {t('common.left')}</option>
      </select>
      <input class="grow" type="text" aria-label={t('common.text')} placeholder={t('common.text')} bind:value={a.text} />
      <label class="check" title={t('an.hide')}><input type="checkbox" bind:checked={a.hidden} />{t('an.hide')}</label>
      {#if a.dx !== 0 || a.dy !== 0}
        <button class="btn small" title={t('an.resetOffset')} onclick={() => { a.dx = 0; a.dy = 0; }}>↺</button>
      {/if}
      <button class="btn small icon danger" title={t('common.delete')} onclick={() => piece.annotations.splice(i, 1)}>×</button>
    </div>
  {/each}
</div>
<div class="line"><button class="btn" onclick={add}>{t('common.add')}</button></div>
