<script lang="ts">
  import { newId } from '../../domain/ids';
  import type { Piece } from '../../domain/types';
  import { t } from '../../i18n/index.svelte';
  import { app } from '../../stores/app.svelte';
  import KeyInput from '../KeyInput.svelte';
  import PosInput from '../PosInput.svelte';

  let { piece }: { piece: Piece } = $props();

  function add() {
    const last = piece.passing[piece.passing.length - 1];
    const step = 1 / piece.meta.meter.beats;
    piece.passing.push({ id: newId(), pos: last ? last.pos + step : 1, key: last ? { ...last.key } : { ...piece.meta.center } });
  }
</script>

<p class="hint">{t('an.passingHelp')}</p>
<div class="lines">
  {#each piece.passing as p, i (i)}
    <div
      class="line"
      class:selected={app.selection?.id === p.id}
      data-row-id={p.id}
      onfocusin={() => (app.selection = { kind: 'passing', id: p.id })}
    >
      <div class="n"><PosInput label={t('common.bar')} value={p.pos} meter={piece.meta.meter} onchange={(v) => (p.pos = v)} /></div>
      <div class="k"><KeyInput label={t('an.key')} value={p.key} names={piece.style.noteNames} onchange={(k) => (p.key = k)} /></div>
      <button class="btn small icon danger" title={t('common.delete')} onclick={() => piece.passing.splice(i, 1)}>×</button>
    </div>
  {/each}
</div>
<div class="line"><button class="btn" onclick={add}>{t('common.add')}</button></div>
