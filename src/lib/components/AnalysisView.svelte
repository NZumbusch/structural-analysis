<script lang="ts">
  import type { Piece } from '../domain/types';
  import { t } from '../i18n/index.svelte';
  import ChartPreview from './ChartPreview.svelte';
  import Panel from './Panel.svelte';
  import AnnotationsEditor from './editors/AnnotationsEditor.svelte';
  import HighlightsEditor from './editors/HighlightsEditor.svelte';
  import PassingEditor from './editors/PassingEditor.svelte';
  import SectionsEditor from './editors/SectionsEditor.svelte';
  import SegmentsEditor from './editors/SegmentsEditor.svelte';

  let { piece }: { piece: Piece } = $props();

  /** On narrow screens only one of input and preview is visible at a time. */
  let pane = $state<'input' | 'preview'>('input');
</script>

<div class="switch" role="tablist">
  <button class="btn" class:on={pane === 'input'} role="tab" aria-selected={pane === 'input'} onclick={() => (pane = 'input')}>{t('an.input')}</button>
  <button class="btn" class:on={pane === 'preview'} role="tab" aria-selected={pane === 'preview'} onclick={() => (pane = 'preview')}>{t('an.preview')}</button>
</div>

<div class="layout">
  <section class="inputs" class:hide={pane !== 'input'}>
    <Panel title={t('an.keys')} count={piece.segments.length} open>
      <SegmentsEditor {piece} />
    </Panel>
    <Panel title={t('an.passing')} count={piece.passing.length}>
      <PassingEditor {piece} />
    </Panel>
    <Panel title={t('an.annotations')} count={piece.annotations.length}>
      <AnnotationsEditor {piece} />
    </Panel>
    <Panel title={t('an.sections')} count={piece.sections.length}>
      <SectionsEditor {piece} />
    </Panel>
    <Panel title={t('an.highlights')} count={piece.highlights.length}>
      <HighlightsEditor {piece} />
    </Panel>
    <p class="hint">{t('an.undoHint')}</p>
  </section>

  <section class="side" class:hide={pane !== 'preview'}>
    <ChartPreview {piece} />
  </section>
</div>

<style>
  .layout {
    display: grid; gap: 16px; padding: 16px; max-width: 1600px; margin: 0 auto;
    grid-template-columns: minmax(340px, 480px) minmax(0, 1fr); align-items: start;
  }
  .inputs { display: grid; gap: 12px; min-width: 0; }
  .side { min-width: 0; position: sticky; top: calc(var(--header-h) + var(--tabs-h) + 56px); }
  .switch { display: none; gap: 6px; padding: 12px 16px 0; }
  .switch .btn { flex: 1; }
  .switch .on { background: var(--accent-soft); border-color: var(--accent); font-weight: 600; }
  @media (max-width: 960px) {
    .layout { grid-template-columns: minmax(0, 1fr); }
    .switch { display: flex; }
    .hide { display: none; }
    .side { position: static; }
  }
</style>
