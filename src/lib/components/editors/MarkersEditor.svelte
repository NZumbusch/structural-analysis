<script lang="ts">
  import { newId } from '../../domain/ids';
  import type { Piece } from '../../domain/types';
  import { t } from '../../i18n/index.svelte';
  import { app } from '../../stores/app.svelte';
  import PosInput from '../PosInput.svelte';

  let { piece }: { piece: Piece } = $props();

  function add() {
    piece.markers.push({ id: newId(), pos: 1, label: String.fromCharCode(65 + (piece.markers.length % 26)), line: true });
  }
</script>

<p class="hint">{t('an.markersHelp')}</p>
<div class="lines">
  {#each piece.markers as m, i (i)}
    <div
      class="line"
      class:selected={app.selection?.id === m.id}
      data-row-id={m.id}
      onfocusin={() => (app.selection = { kind: 'marker', id: m.id })}
    >
      <div class="n"><PosInput label={t('common.bar')} value={m.pos} meter={piece.meta.meter} onchange={(v) => (m.pos = v)} /></div>
      <input class="grow" type="text" aria-label={t('an.label')} placeholder={t('an.label')} bind:value={m.label} />
      <label class="check"><input type="checkbox" bind:checked={m.line} />{t('an.markerLine')}</label>
      <button class="btn small icon danger" title={t('common.delete')} onclick={() => piece.markers.splice(i, 1)}>×</button>
    </div>
  {/each}
</div>
<div class="line"><button class="btn" onclick={add}>{t('common.add')}</button></div>
