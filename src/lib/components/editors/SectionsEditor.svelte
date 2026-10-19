<script lang="ts">
  import { newId } from '../../domain/ids';
  import type { Piece } from '../../domain/types';
  import { t } from '../../i18n/index.svelte';
  import NumInput from '../NumInput.svelte';

  let { piece }: { piece: Piece } = $props();

  function add() {
    const last = piece.sections[piece.sections.length - 1];
    piece.sections.push({ id: newId(), name: '', from: last ? last.from + 8 : 1, shade: false });
  }
</script>

<p class="hint">{t('an.sectionsHelp')}</p>
<div class="lines">
  {#each piece.sections as s, i (i)}
    <div class="line">
      <input class="grow" type="text" aria-label={t('an.name')} placeholder={t('an.name')} bind:value={s.name} />
      <div class="n"><NumInput label={t('an.from')} value={s.from} step={1} min={1} onchange={(v) => (s.from = v ?? s.from)} /></div>
      <label class="check"><input type="checkbox" bind:checked={s.shade} />{t('an.shade')}</label>
      <button class="btn small icon danger" title={t('common.delete')} onclick={() => piece.sections.splice(i, 1)}>×</button>
    </div>
  {/each}
</div>
<div class="line"><button class="btn" onclick={add}>{t('common.add')}</button></div>
