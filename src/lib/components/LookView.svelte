<script lang="ts">
  import type { Piece } from '../domain/types';
  import { app } from '../stores/app.svelte';
  import { t } from '../i18n/index.svelte';
  import ChartPreview from './ChartPreview.svelte';
  import SettingsPanel from './settings/SettingsPanel.svelte';
  import SimpleNote from './SimpleNote.svelte';

  let { piece }: { piece: Piece } = $props();
</script>

<div class="layout">
  <section class="settings">
    <SimpleNote />
    <h2>{t('tab.look')}</h2>
    <p class="muted small">{t('look.intro')}</p>
    <SettingsPanel {piece} groups={['look', 'text', 'content']} simple={app.simple} />
  </section>

  <section class="side">
    <ChartPreview {piece} editable />
  </section>
</div>

<style>
  .layout {
    display: grid; gap: 16px; padding: 16px; max-width: 1600px; margin: 0 auto;
    grid-template-columns: minmax(320px, 460px) minmax(0, 1fr); align-items: start;
  }
  .settings { display: grid; gap: 12px; min-width: 0; }
  h2 { margin: 0; }
  .settings p { margin: 0; }
  .side { min-width: 0; position: sticky; top: calc(var(--header-h) + var(--tabs-h) + 12px); }
  @media (max-width: 960px) {
    .layout { grid-template-columns: minmax(0, 1fr); }
    .side { position: static; order: -1; }
  }
</style>
