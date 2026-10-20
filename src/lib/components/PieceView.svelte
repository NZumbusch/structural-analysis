<script lang="ts">
  import { displayTitle } from '../domain/piece';
  import type { Piece } from '../domain/types';
  import { t } from '../i18n/index.svelte';
  import ChartPreview from './ChartPreview.svelte';
  import KeyInput from './KeyInput.svelte';

  let { piece }: { piece: Piece } = $props();
</script>

<div class="layout">
  <section class="card form">
    <h2>{t('piece.heading')}</h2>

    <label class="field">
      <span>{t('piece.title')}</span>
      <input type="text" bind:value={piece.meta.title} placeholder={t('piece.titleHint')} />
    </label>
    <label class="field">
      <span>{t('piece.composer')}</span>
      <input type="text" bind:value={piece.meta.composer} />
    </label>
    <div class="two">
      <label class="field">
        <span>{t('piece.year')}</span>
        <input type="text" inputmode="numeric" bind:value={piece.meta.year} />
      </label>
      <label class="field">
        <span>{t('piece.catalog')}</span>
        <input type="text" bind:value={piece.meta.catalog} placeholder={t('piece.catalogHint')} />
      </label>
    </div>
    <label class="field">
      <span>{t('piece.movement')}</span>
      <input type="text" bind:value={piece.meta.movement} placeholder={t('piece.movementHint')} />
    </label>

    <div class="field">
      <span>{t('piece.center')}</span>
      <KeyInput label={t('piece.center')} value={piece.meta.center} names={piece.style.noteNames} onchange={(k) => (piece.meta.center = k)} />
    </div>
    <p class="hint">{t('piece.centerHint')}</p>

    <label class="field">
      <span>{t('piece.subtitle')}</span>
      <input type="text" bind:value={piece.meta.subtitle} />
      <span class="hint">{t('piece.subtitleHint')}</span>
    </label>
    <details class="prov">
      <summary class="light"><span class="chev" aria-hidden="true"></span>{t('piece.provenance')}</summary>
      <div class="provbody">
        <label class="field">
          <span>{t('piece.source')}</span>
          <input type="text" bind:value={piece.meta.source} placeholder={t('piece.sourceHint')} />
        </label>
        <div class="two">
          <label class="field">
            <span>{t('piece.analyst')}</span>
            <input type="text" bind:value={piece.meta.analyst} />
          </label>
          <label class="field">
            <span>{t('piece.analysisDate')}</span>
            <input type="date" bind:value={piece.meta.analysisDate} />
          </label>
        </div>
        <p class="hint">{t('piece.provenanceHint')}</p>
      </div>
    </details>
    <label class="field">
      <span>{t('piece.notes')}</span>
      <textarea rows="3" bind:value={piece.meta.notes}></textarea>
      <span class="hint">{t('piece.notesHint')}</span>
    </label>
  </section>

  <section class="side">
    <p class="label">{t('piece.titlePreview')}: <strong>{displayTitle(piece) || t('common.untitled')}</strong></p>
    <ChartPreview {piece} />
  </section>
</div>

<style>
  .layout {
    display: grid; gap: 16px; padding: 16px; max-width: 1400px; margin: 0 auto;
    grid-template-columns: minmax(300px, 420px) minmax(0, 1fr); align-items: start;
  }
  .form { padding: 16px; display: grid; gap: 12px; }
  .side { display: grid; gap: 8px; min-width: 0; position: sticky; top: calc(var(--header-h) + var(--tabs-h) + 12px); }
  .provbody { display: grid; gap: 10px; margin-top: 6px; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (max-width: 860px) {
    .layout { grid-template-columns: minmax(0, 1fr); }
    .side { position: static; order: -1; }
  }
</style>
