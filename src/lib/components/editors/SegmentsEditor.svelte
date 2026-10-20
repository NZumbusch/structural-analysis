<script lang="ts">
    import { untrack } from 'svelte';
  import { meterMap } from '../../domain/structure';
  import { parseSegments, serializeSegments, type ParseError } from '../../domain/segments-text';
  import { newId } from '../../domain/ids';
  import { TONICIZATIONS } from '../../domain/types';
  import type { Piece, Segment } from '../../domain/types';
  import { t, type TKey } from '../../i18n/index.svelte';
  import { app } from '../../stores/app.svelte';
  import PosInput from '../PosInput.svelte';
  import KeyInput from '../KeyInput.svelte';

  let { piece }: { piece: Piece } = $props();

  const names = $derived(piece.style.noteNames);
  const meter = $derived(meterMap(piece));
  const initial = untrack(() => serializeSegments(piece.segments, piece.style.noteNames, meterMap(piece)));
  let text = $state(initial);
  /** The serialisation the textarea currently stands for; used to tell outside edits from our own. */
  let synced = initial;
  let errors = $state<ParseError[]>([]);

  // Table edits, undo, note-name changes … rewrite the text; edits from the textarea itself do not.
  $effect(() => {
    const current = serializeSegments(piece.segments, names, meter);
    if (current !== synced) {
      text = current;
      synced = current;
      errors = [];
    }
  });

  function onTextInput() {
    const result = parseSegments(text, names, meter, piece.segments);
    errors = result.errors;
    synced = serializeSegments(result.segments, names, meter);
    piece.segments = result.segments;
  }

  function flipMode(s: Segment) {
    s.key = { fifths: s.key.fifths, mode: s.key.mode === 'major' ? 'minor' : 'major' };
  }

  function add(after = piece.segments.length - 1) {
    const prev = piece.segments[after];
    const from = prev ? prev.to : 1;
    const seg: Segment = {
      id: newId(),
      from,
      to: from + 4,
      key: prev ? { ...prev.key } : { ...piece.meta.center },
      kind: 'key',
      label: '',
    };
    piece.segments.splice(after + 1, 0, seg);
  }

  function sort() {
    piece.segments = [...piece.segments].sort((a, b) => a.from - b.from || a.to - b.to);
  }
</script>

<div class="grid">
  <details class="help" open={!app.isMobile}>
    <summary>{t('an.syntax')}</summary>
    <p class="hint">{t('an.keysHelp')}</p>
  </details>

  <label class="field">
    <span>{t('an.textLabel')}</span>
    <textarea
      class="mono"
      class:invalid={errors.length > 0}
      rows="10"
      bind:value={text}
      oninput={onTextInput}
      placeholder={t('an.keysExample')}
      autocapitalize="off"
      autocomplete="off"
      spellcheck="false"
    ></textarea>
  </label>
  {#each errors as e (e.line + e.message)}
    <p class="err">{t(`an.err.${e.message}` as TKey, { line: e.line })}</p>
  {/each}

  <div class="label">{t('an.tableLabel')}</div>
  <div class="lines">
    {#each piece.segments as seg, i (i)}
      <div
        class="line"
        class:selected={app.selection?.id === seg.id}
        data-row-id={seg.id}
        onfocusin={() => (app.selection = { kind: 'segment', id: seg.id })}
      >
        <div class="n"><PosInput label={t('an.from')} value={seg.from} {meter} onchange={(v) => (seg.from = v)} /></div>
        <div class="n"><PosInput label={t('an.to')} value={seg.to} {meter} onchange={(v) => (seg.to = v)} /></div>
        <div class="k"><KeyInput label={t('an.key')} value={seg.key} {names} onchange={(k) => (seg.key = k)} /></div>
        <button class="btn small toggle" class:on={seg.key.mode === 'minor'} title={t('an.mode')} onclick={() => flipMode(seg)}>
          {seg.key.mode === 'major' ? 'Dur' : 'Moll'}
        </button>
        <select class="kindsel" aria-label={t('an.kind')} title={t('an.kind')} bind:value={seg.kind}>
          <option value="key">{t('kind.key')}</option>
          {#each TONICIZATIONS as k (k)}<option value={k}>{t(`kind.${k}` as TKey)}</option>{/each}
        </select>
        {#if !app.simple}
          <input class="grow" type="text" aria-label={t('an.barLabel')} placeholder={t('an.barLabel')} bind:value={seg.label} />
        {/if}
        <button class="btn small icon" title={t('an.addRow')} onclick={() => add(i)}>+</button>
        <button class="btn small icon danger" title={t('common.delete')} onclick={() => piece.segments.splice(i, 1)}>×</button>
      </div>
    {:else}
      <p class="muted small">{t('an.empty')}</p>
    {/each}
  </div>
  <div class="line">
    <button class="btn" onclick={() => add()}>{t('an.addRow')}</button>
    <button class="btn" onclick={sort} disabled={piece.segments.length < 2}>{t('an.sort')}</button>
  </div>
</div>

<style>
  .grid { display: grid; gap: 10px; }
  .help summary { cursor: pointer; font-size: 0.9rem; color: var(--muted); padding: 2px 0; }
  .kindsel { flex: 0 0 auto; width: auto; max-width: 150px; min-height: 32px; padding: 2px 6px; }
</style>
