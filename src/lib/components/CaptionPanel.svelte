<script lang="ts">
  import { buildCaption } from '../analysis/caption';
  import type { Piece } from '../domain/types';
  import { t } from '../i18n/index.svelte';
  import { app } from '../stores/app.svelte';

  let { piece }: { piece: Piece } = $props();

  let figure = $state('');
  const view = $derived(piece.views.find((v) => v.id === app.activeViewId) ?? null);
  const text = $derived(
    buildCaption(piece, {
      view: view ? { from: view.from, to: view.to } : null,
      figure: figure.trim() || undefined,
      countRepeats: piece.style.repeatDisplay === 'expanded',
    }),
  );

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      app.notify(t('cap.copied'));
    } catch {
      app.notify(t('ex.copyFailed'));
    }
  }
</script>

<details class="card box">
  <summary>
    <span class="chev" aria-hidden="true">›</span>
    <h3>{t('cap.title')}</h3>
  </summary>
  <div class="body">
    <p class="hint">{t('cap.hint')}</p>
    <label class="field">
      <span>{t('cap.figure')}</span>
      <input type="text" bind:value={figure} placeholder="1" autocomplete="off" />
    </label>
    <div class="field">
      <span>{t('cap.caption')}</span>
      <textarea readonly rows="4" value={text.caption}></textarea>
      <div class="line"><button class="btn small" onclick={() => copy(text.caption)}>{t('stats.copy')}</button></div>
    </div>
    <div class="field">
      <span>{t('cap.method')}</span>
      <textarea readonly rows="7" value={text.method}></textarea>
      <div class="line"><button class="btn small" onclick={() => copy(text.method)}>{t('stats.copy')}</button></div>
    </div>
  </div>
</details>

<style>
  summary { display: flex; align-items: center; gap: 8px; padding: 12px 14px; cursor: pointer; list-style: none; user-select: none; }
  summary::-webkit-details-marker { display: none; }
  .chev { display: inline-block; width: 1em; transition: transform 0.15s; color: var(--muted); font-size: 1.2rem; line-height: 1; }
  details[open] > summary .chev { transform: rotate(90deg); }
  .body { padding: 0 14px 14px; display: grid; gap: 10px; }
</style>
