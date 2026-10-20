<script lang="ts">
  import { newId } from '../../domain/ids';
  import { lastBarOf } from '../../domain/piece';
  import type { Piece } from '../../domain/types';
  import { t } from '../../i18n/index.svelte';
  import { app } from '../../stores/app.svelte';
  import PosInput from '../PosInput.svelte';

  let { piece }: { piece: Piece } = $props();

  function add() {
    const last = piece.views[piece.views.length - 1];
    const from = last ? last.to : 1;
    const to = Math.min(from + 8, lastBarOf(piece) + 1);
    const view = { id: newId(), name: `${t('an.view')} ${piece.views.length + 1}`, from, to: Math.max(to, from + 1) };
    piece.views.push(view);
    app.activeViewId = view.id;
  }

  function remove(i: number) {
    if (app.activeViewId === piece.views[i].id) app.activeViewId = null;
    piece.views.splice(i, 1);
  }
</script>

<p class="hint">{t('an.viewsHelp')}</p>
<div class="lines">
  {#each piece.views as v, i (i)}
    <div class="line" class:selected={app.activeViewId === v.id}>
      <input class="grow" type="text" aria-label={t('an.name')} placeholder={t('an.name')} bind:value={v.name} />
      <div class="n"><PosInput label={t('an.from')} value={v.from} meter={piece.meta.meter} onchange={(x) => (v.from = x)} /></div>
      <div class="n"><PosInput label={t('an.to')} value={v.to} meter={piece.meta.meter} onchange={(x) => (v.to = x)} /></div>
      <button class="btn small toggle" class:on={app.activeViewId === v.id} onclick={() => (app.activeViewId = app.activeViewId === v.id ? null : v.id)}>
        {t('an.showView')}
      </button>
      <button class="btn small icon danger" title={t('common.delete')} onclick={() => remove(i)}>×</button>
    </div>
  {/each}
</div>
<div class="line"><button class="btn" onclick={add}>{t('common.add')}</button></div>
