<script lang="ts">
  import type { Piece } from '../../domain/types';
  import type { ExportPrefs } from '../../export/prefs';
  import { applyPreset, PRESETS, type Preset } from '../../export/presets';
  import type { ViewRange } from '../../render/chart';
  import { t } from '../../i18n/index.svelte';
  import { app } from '../../stores/app.svelte';

  let { piece, exp, range }: { piece: Piece; exp: ExportPrefs; range: ViewRange | null } = $props();

  function apply(p: Preset) {
    applyPreset(piece, exp, p, range);
    app.notify(t('set.p.applied', { name: t(p.label) }));
  }
</script>

<div class="chips">
  {#each PRESETS as p (p.id)}
    <button class="chip" onclick={() => apply(p)}>{t(p.label)}</button>
  {/each}
</div>
<p class="hint">{t('set.p.hint')}</p>

<style>
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { padding: 6px 12px; border-radius: 99px; border: 1px solid var(--border); background: var(--surface); cursor: pointer; }
  .chip:hover { border-color: var(--accent); }
  p { margin: 4px 0 0; }
</style>
