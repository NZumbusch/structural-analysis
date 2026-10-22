<script lang="ts">
  import { untrack } from 'svelte';
  import { remember } from '../../ui/remember';
  import { meterMap } from '../../domain/structure';
  import { parseSegments, serializeSegments, type ParseError } from '../../domain/segments-text';
  import { newId } from '../../domain/ids';
  import { TONICIZATIONS } from '../../domain/types';
  import type { Piece, Segment } from '../../domain/types';
  import { t, type TKey } from '../../i18n/index.svelte';
  import { app } from '../../stores/app.svelte';
  import PosInput from '../PosInput.svelte';
  import KeyInput from '../KeyInput.svelte';
  import NumInput from '../NumInput.svelte';

  let { piece }: { piece: Piece } = $props();

  const MODE_KEY = 'tonartenverlauf.keyMode';
  /** Quick text on laptops, the table on phones, until the user picks one. */
  let mode = $state<'text' | 'table'>(
    (() => {
      try {
        const v = localStorage.getItem(MODE_KEY);
        if (v === 'text' || v === 'table') return v;
      } catch {
        /* default */
      }
      return app.isMobile ? 'table' : 'text';
    })(),
  );
  function setMode(m: 'text' | 'table') {
    mode = m;
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* not remembered */
    }
  }

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

  <div class="seg" role="group" aria-label={t('an.entry')}>
    <button class="btn small" class:on={mode === 'text'} aria-pressed={mode === 'text'} onclick={() => setMode('text')}>{t('an.mode.text')}</button>
    <button class="btn small" class:on={mode === 'table'} aria-pressed={mode === 'table'} onclick={() => setMode('table')}>{t('an.mode.table')}</button>
  </div>

  {#if mode === 'text'}
  <details class="help" use:remember={'an.keyHelp'}>
    <summary class="light"><span class="chev" aria-hidden="true"></span>{t('an.syntax')}</summary>
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

  {:else}
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
        <div class="len"><NumInput label={t('an.length')} value={Math.round((seg.to - seg.from) * 1000) / 1000} step={0.25} min={0.05} onchange={(v) => v !== null && (seg.to = seg.from + v)} /></div>
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
  {/if}
</div>

<style>
  .grid { display: grid; gap: 10px; }
  .seg { display: flex; gap: 6px; }
  .seg .btn { flex: 1; }
  .seg .on { background: var(--accent-soft); border-color: var(--accent); font-weight: 600; }
  .line > .len { flex: 0 0 64px; }
  .kindsel { flex: 0 0 auto; width: auto; max-width: 150px; min-height: 32px; padding: 2px 6px; }
</style>
