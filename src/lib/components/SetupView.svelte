<script lang="ts">
  import { tick } from 'svelte';
  import { remember } from '../ui/remember';
  import { formatPos } from '../domain/positions';
  import { termDefinition, termName, termsOf, TERM_DISPLAYS, VOCABULARIES, type FormTerm, type VocabId } from '../domain/formterms';
  import { endPos, insertBars, deleteBars, lastBarOf, makeEvent, meterMap, sectionSpans, sortedEvents } from '../domain/structure';
  import type { EventKind, Piece, StructEvent } from '../domain/types';
  import { t, type TKey } from '../i18n/index.svelte';
  import { app } from '../stores/app.svelte';
  import ChartPreview from './ChartPreview.svelte';
  import NumInput from './NumInput.svelte';
  import PosInput from './PosInput.svelte';
  import SimpleNote from './SimpleNote.svelte';

  let { piece }: { piece: Piece } = $props();

  type Tool = 'meter' | 'repeat' | 'volta' | 'section' | 'subsection' | 'marker' | 'text' | 'barline' | 'keysig' | 'fermata';

  const EPS = 1e-9;
  const COLORS = ['#7cc4a6', '#9a93e6', '#f0b45a', '#e08aa5', '#6fb0e0', '#b5c46a'];

  let pane = $state<'edit' | 'preview'>('edit');

  // Bring the list row of whatever was picked in the preview into view.
  $effect(() => {
    const id = app.selection?.kind === 'event' ? app.selection.id : null;
    if (!id) return;
    void tick().then(() => document.querySelector(`[data-row-id="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  });
  let sel = $state<{ from: number; to: number } | null>(null);
  let anchor = $state<number | null>(null);
  let extend = $state(false);
  let tool = $state<Tool | null>(null);
  let count = $state(1);
  let moreOpen = $state(false);

  // vocabulary of form theory for the chips under "Unterteil" and "Marke"
  const VOCAB_KEY = 'tonartenverlauf.vocab';
  let vocab = $state<VocabId>(
    (() => {
      try {
        const v = localStorage.getItem(VOCAB_KEY);
        return VOCABULARIES.some((x) => x.id === v) ? (v as VocabId) : 'sonata-theory';
      } catch {
        return 'sonata-theory';
      }
    })(),
  );
  let fullNames = $state(false);
  /** The concept of the term button that was clicked, remembered on the new event. */
  let pendingTerm = '';
  function setVocab(v: VocabId) {
    vocab = v;
    try {
      localStorage.setItem(VOCAB_KEY, v);
    } catch {
      /* not remembered */
    }
  }

  // tool inputs
  let beats = $state(3);
  let unit = $state(4);
  let times = $state(2);
  let endings = $state('1');
  let name = $state('');
  let shade = $state(false);
  let label = $state('');
  let line = $state(true);
  let barStyle = $state<'double' | 'final'>('double');
  let fifths = $state(0);

  const meters = $derived(meterMap(piece));
  const bars = $derived(Math.max(lastBarOf(piece), Math.ceil(endPos(piece)) - 1));
  const events = $derived(sortedEvents(piece));
  const spans = $derived(sectionSpans(piece));
  const pickup = $derived((piece.meta.pickup ?? 0) > 0);

  interface Cell {
    bar: number;
    meter: string;
    repeatStart: boolean;
    repeatEnd: number;
    volta: string;
    voltaStart: boolean;
    section: string;
    sub: string;
    secColor: string;
    subColor: string;
    chips: string[];
  }

  const chipOf = (e: StructEvent): string => {
    switch (e.kind) {
      case 'marker': return e.label || '▪';
      case 'text': return `♪ ${e.label}`;
      case 'barline': return e.style === 'final' ? '‖▌' : '‖';
      case 'keysig': return e.fifths === 0 ? '♮' : `${Math.abs(e.fifths)}${e.fifths > 0 ? '♯' : '♭'}`;
      case 'fermata': return '◠';
      default: return '';
    }
  };

  const cells = $derived.by<Cell[]>(() => {
    const list: Cell[] = [];
    const first = pickup ? 0 : 1;
    let mainIndex = -1;
    const mainOf = new Map<string, number>();
    for (const sp of spans) if (sp.id) mainOf.set(sp.id, ++mainIndex);
    for (let b = first; b <= bars; b++) {
      const m = meters.at(b);
      const changed = b === first || events.some((e) => e.kind === 'meter' && Math.floor(e.pos + EPS) === b);
      const here = (e: StructEvent) => Math.floor(e.pos + EPS) === b && Math.abs(e.pos - Math.round(e.pos)) < 0.01;
      const sp = spans.find((s) => b >= s.from - EPS && b < s.to - EPS);
      const sub = sp?.subs.find((s) => b >= s.from - EPS && b < s.to - EPS);
      const volta = events.find((e) => e.kind === 'volta' && b >= e.pos - EPS && b < e.to - EPS);
      const re = events.find((e) => e.kind === 'repeat-end' && Math.abs(e.pos - (b + 1)) < 0.01);
      const secIdx = sp && sp.id ? mainOf.get(sp.id)! : -1;
      list.push({
        bar: b,
        meter: changed ? `${m.beats}/${m.unit}` : '',
        repeatStart: events.some((e) => e.kind === 'repeat-start' && here(e)),
        repeatEnd: re ? re.times : 0,
        volta: volta ? `${volta.numbers.join(',')}.` : '',
        voltaStart: !!volta && Math.floor(volta.pos + EPS) === b,
        section: sp && sp.id && Math.floor(sp.from + EPS) === b ? sp.name : '',
        sub: sub && Math.floor(sub.from + EPS) === b ? sub.name : '',
        secColor: secIdx >= 0 ? COLORS[secIdx % COLORS.length] : 'transparent',
        subColor: sub && secIdx >= 0 ? `color-mix(in srgb, ${COLORS[secIdx % COLORS.length]} 55%, var(--surface))` : 'transparent',
        chips: events.filter((e) => ['marker', 'text', 'barline', 'keysig', 'fermata'].includes(e.kind) && here(e)).map(chipOf),
      });
    }
    return list;
  });

  const inSel = (b: number) => !!sel && b >= sel.from && b <= sel.to;
  const selCount = $derived(sel ? sel.to - sel.from + 1 : 0);

  function pick(b: number, e: MouseEvent) {
    if ((e.shiftKey || extend) && anchor !== null) {
      sel = { from: Math.min(anchor, b), to: Math.max(anchor, b) };
      extend = false;
    } else {
      anchor = b;
      sel = { from: b, to: b };
    }
  }

  // ---- adding events -----------------------------------------------------------------------------------
  const SINGLE: EventKind[] = ['meter', 'section', 'subsection', 'repeat-start', 'repeat-end', 'keysig'];

  function upsert(kind: EventKind, pos: number, extra: Partial<StructEvent> = {}): StructEvent {
    if (SINGLE.includes(kind)) piece.events = piece.events.filter((e) => !(e.kind === kind && Math.abs(e.pos - pos) < EPS));
    const ev = makeEvent(kind, pos, extra);
    piece.events.push(ev);
    return ev;
  }

  function choose(next: Tool) {
    tool = tool === next ? null : next;
    if (tool === 'meter') {
      const m = meters.at(sel?.from ?? 1);
      beats = m.beats;
      unit = m.unit;
    }
  }

  function addEvent() {
    if (!sel || !tool) return;
    const from = sel.from;
    const after = sel.to + 1;
    let created: StructEvent | null = null;
    switch (tool) {
      case 'meter': created = upsert('meter', from, { beats, unit }); break;
      case 'repeat':
        upsert('repeat-start', from);
        created = upsert('repeat-end', after, { times });
        break;
      case 'volta': {
        const numbers = endings.split(/[,\s]+/).map((x) => parseInt(x, 10)).filter((x) => x > 0);
        created = upsert('volta', from, { to: after, numbers: numbers.length ? numbers : [1] });
        break;
      }
      case 'section': created = upsert('section', from, { name, shade }); break;
      case 'subsection': created = upsert('subsection', from, { name, term: pendingTerm }); break;
      case 'marker': created = upsert('marker', from, { label, line, term: pendingTerm }); break;
      case 'text': created = upsert('text', from, { label }); break;
      case 'barline': created = upsert('barline', after, { style: barStyle }); break;
      case 'keysig': created = upsert('keysig', from, { fifths }); break;
      case 'fermata': created = upsert('fermata', from + 0.5); break;
    }
    if (created) app.selection = { kind: 'event', id: created.id };
    name = '';
    label = '';
    pendingTerm = '';
  }

  /** One click on a term adds it at the selected bar (undo takes it back). */
  function addTerm(term: FormTerm) {
    const text = fullNames ? termName(term, piece.style.language) : term.short;
    pendingTerm = term.id;
    if (tool === 'subsection') name = text;
    else {
      label = text;
      line = !!term.line;
    }
    addEvent();
  }

  /** Labels that were typed (or added before terms were remembered) become terms when they match the vocabulary exactly. */
  function recognise() {
    const terms = VOCABULARIES.find((v) => v.id === vocab)!.terms;
    let n = 0;
    for (const e of piece.events) {
      if (e.term) continue;
      const zone = e.kind === 'subsection';
      if (!zone && e.kind !== 'marker' && e.kind !== 'text') continue;
      const hit = terms.find((x) => x.short === (zone ? e.name : e.label).trim() && (x.kind === 'zone') === zone);
      if (hit) {
        e.term = hit.id;
        n++;
      }
    }
    app.notify(t('form.recognised', { n }));
  }

  const toolNeedsInput = (k: Tool) => !['repeat', 'fermata'].includes(k);

  // ---- changing the number of bars -----------------------------------------------------------------------------
  function insert(where: 'before' | 'after') {
    if (!sel) return;
    const n = Math.max(1, Math.round(count));
    const at = where === 'before' ? sel.from : sel.to + 1;
    insertBars(piece, at, n);
    sel = { from: at, to: at + n - 1 };
    anchor = at;
  }

  function remove() {
    if (!sel) return;
    const n = selCount;
    deleteBars(piece, sel.from, n);
    app.notify(t('setup.deleted', { n }));
    sel = null;
    anchor = null;
  }

  function append(n: number) {
    piece.meta.lastBar = lastBarOf(piece) + n;
  }

  const removeEvent = (id: string) => (piece.events = piece.events.filter((e) => e.id !== id));
  /** Kinds that can pile up (imported cadence marks, say) and be cleared in one go. */
  const clearable = $derived(
    (['marker', 'text', 'barline', 'keysig', 'fermata'] as const)
      .map((kind) => ({ kind, n: events.filter((e) => e.kind === kind).length }))
      .filter((c) => c.n > 1),
  );
  function removeAll(kind: string, n: number) {
    if (!confirm(t('setup.confirmClear', { n, kind: kindLabel(kind) }))) return;
    piece.events = piece.events.filter((e) => e.kind !== kind);
  }
  const unitOptions = [1, 2, 4, 8, 16];
  const tools: Tool[] = ['meter', 'repeat', 'volta', 'section', 'subsection'];
  const moreTools: Tool[] = ['marker', 'text', 'barline', 'keysig', 'fermata'];
  const kindLabel = (k: string) => t(`ev.${k}` as TKey);
</script>

<div class="switch" role="tablist">
  <button class="btn" class:on={pane === 'edit'} role="tab" aria-selected={pane === 'edit'} onclick={() => (pane = 'edit')}>{t('an.input')}</button>
  <button class="btn" class:on={pane === 'preview'} role="tab" aria-selected={pane === 'preview'} onclick={() => (pane = 'preview')}>{t('an.preview')}</button>
</div>

<div class="layout">
  <section class="main" class:hide={pane !== 'edit'}>
    <SimpleNote />
    <details class="card structure" open={piece.events.length === 0 && piece.segments.length === 0} use:remember={'setup.structure'}>
      <summary class="head"><span class="chev" aria-hidden="true"></span><h3>{t('setup.structure')}</h3></summary>
      <div class="box">
      <div class="row">
        <div class="field">
          <span>{t('setup.bars')}</span>
          <NumInput label={t('setup.bars')} min={1} max={2000} value={bars} onchange={(v) => (piece.meta.lastBar = Math.max(1, Math.round(v ?? bars)))} />
        </div>
        <div class="field">
          <span>{t('setup.meter')}</span>
          <div class="meter">
            <NumInput label={t('ev.beats')} min={1} max={32} value={piece.meta.meter.beats} onchange={(v) => (piece.meta.meter.beats = Math.max(1, Math.round(v ?? 4)))} />
            <span>/</span>
            <select aria-label={t('ev.unit')} bind:value={piece.meta.meter.unit}>
              {#each unitOptions as u (u)}<option value={u}>{u}</option>{/each}
            </select>
          </div>
        </div>
        <div class="field">
          <span>{t('setup.pickup')}</span>
          <NumInput label={t('setup.pickup')} min={0} max={31} step={0.5} value={piece.meta.pickup} onchange={(v) => (piece.meta.pickup = Math.max(0, v ?? 0))} />
        </div>
      </div>
      <p class="hint">{t('setup.pickupHint')}</p>
      <div class="line">
        <span class="muted small">{t('setup.addBars')}</span>
        {#each [1, 4, 8] as n (n)}<button class="btn small" onclick={() => append(n)}>+{n}</button>{/each}
        <span class="spacer"></span>
        <label class="inline">
          <span class="muted small">{t('setup.repeatDisplay')}</span>
          <select bind:value={piece.style.repeatDisplay}>
            <option value="symbols">{t('setup.repeat.symbols')}</option>
            <option value="expanded">{t('setup.repeat.expanded')}</option>
          </select>
        </label>
      </div>
      </div>
    </details>

    <div class="card box">
      <div class="palette" role="toolbar" aria-label={t('setup.palette')}>
        {#each tools as k (k)}
          <button class="btn small" class:on={tool === k} disabled={!sel} onclick={() => choose(k)}>{kindLabel(k)}</button>
        {/each}
        {#if !app.simple}
          <button class="btn small" class:on={moreOpen || (tool !== null && moreTools.includes(tool))} onclick={() => (moreOpen = !moreOpen)}>{t('setup.more')} ▾</button>
        {/if}
      </div>
      {#if !app.simple && (moreOpen || (tool !== null && moreTools.includes(tool)))}
        <div class="palette">
          {#each moreTools as k (k)}
            <button class="btn small" class:on={tool === k} disabled={!sel} onclick={() => choose(k)}>{kindLabel(k)}</button>
          {/each}
        </div>
      {/if}

      {#if tool && sel}
        <div class="toolform">
          {#if tool === 'meter'}
            <div class="meter">
              <NumInput label={t('ev.beats')} min={1} max={32} value={beats} onchange={(v) => (beats = Math.max(1, Math.round(v ?? 4)))} />
              <span>/</span>
              <select aria-label={t('ev.unit')} bind:value={unit}>{#each unitOptions as u (u)}<option value={u}>{u}</option>{/each}</select>
            </div>
          {:else if tool === 'repeat'}
            <label class="inline"><span class="muted small">{t('ev.times')}</span>
              <NumInput label={t('ev.times')} min={2} max={9} value={times} onchange={(v) => (times = Math.max(2, Math.round(v ?? 2)))} />
            </label>
          {:else if tool === 'volta'}
            <label class="inline"><span class="muted small">{t('ev.endings')}</span>
              <input type="text" bind:value={endings} aria-label={t('ev.endings')} />
            </label>
          {:else if tool === 'section' || tool === 'subsection'}
            <input class="grow" type="text" bind:value={name} placeholder={t('ev.name')} aria-label={t('ev.name')} />
            {#if tool === 'section'}<label class="check"><input type="checkbox" bind:checked={shade} />{t('ev.shade')}</label>{/if}
          {:else if tool === 'marker' || tool === 'text'}
            <input class="grow" type="text" bind:value={label} placeholder={t('ev.label')} aria-label={t('ev.label')} />
            {#if tool === 'marker'}<label class="check"><input type="checkbox" bind:checked={line} />{t('ev.line')}</label>{/if}
          {:else if tool === 'barline'}
            <select bind:value={barStyle} aria-label={t('ev.style')}>
              <option value="double">{t('ev.double')}</option>
              <option value="final">{t('ev.final')}</option>
            </select>
          {:else if tool === 'keysig'}
            <NumInput label={t('ev.fifths')} min={-7} max={7} value={fifths} onchange={(v) => (fifths = Math.round(v ?? 0))} />
          {/if}
          <button class="btn primary small" onclick={addEvent} disabled={toolNeedsInput(tool) && (tool === 'section' || tool === 'subsection') && !name.trim()}>{t('setup.add')}</button>
        </div>
        {#if tool === 'subsection' || tool === 'marker'}
          <div class="terms">
            <div class="line">
              <label class="inline"><span class="muted small">{t('form.vocab')}</span>
                <select value={vocab} onchange={(e) => setVocab(e.currentTarget.value as VocabId)}>
                  {#each VOCABULARIES as v (v.id)}<option value={v.id}>{t(`form.v.${v.id}` as TKey)}</option>{/each}
                </select>
              </label>
              <label class="check"><input type="checkbox" bind:checked={fullNames} />{t('form.full')}</label>
            </div>
            <div class="chips">
              {#each termsOf(vocab, tool === 'subsection' ? 'zone' : 'point') as term (term.id)}
                <button class="chip" title={`${termName(term, piece.style.language)} – ${termDefinition(term, piece.style.language)}`} onclick={() => addTerm(term)}>{term.short}</button>
              {/each}
            </div>
            <label class="inline"><span class="muted small">{t('set.s.termDisplay')}</span>
              <select bind:value={piece.style.termDisplay}>
                {#each TERM_DISPLAYS as m (m)}<option value={m}>{t(`set.td.${m}` as TKey)}</option>{/each}
              </select>
            </label>
            <div class="line"><button class="btn small" onclick={recognise}>{t('form.recognise')}</button></div>
            <p class="hint">{t('form.hint')}</p>
          </div>
        {/if}
      {/if}
    </div>

    <div class="card box">
      <div class="gridhead">
        <h3>{t('setup.grid')}</h3>
        <span class="muted small">{sel ? t('setup.selected', { n: selCount }) : t('setup.pickHint')}</span>
      </div>
      <div class="bars" role="group" aria-label={t('setup.grid')}>
        {#each cells as c (c.bar)}
          {#if c.bar === 0}
            <div class="cell pickup" title={t('setup.pickup')}>
              <span class="num">0</span>
              {#if c.meter}<span class="meter">{c.meter}</span>{/if}
            </div>
          {:else}
            <button
              class="cell"
              class:selected={inSel(c.bar)}
              class:rs={c.repeatStart}
              class:re={c.repeatEnd > 0}
              class:volta={!!c.volta}
              style:--sec={c.secColor}
              style:--sub={c.subColor}
              aria-pressed={inSel(c.bar)}
              aria-label={`${t('common.bar')} ${c.bar}`}
              onclick={(e) => pick(c.bar, e)}
            >
              <span class="num">{c.bar}</span>
              {#if c.meter}<span class="meter">{c.meter}</span>{/if}
              {#if c.repeatStart}<span class="rep">‖:</span>{/if}
              {#if c.repeatEnd > 0}<span class="rep end">:‖{c.repeatEnd !== 2 ? c.repeatEnd + '×' : ''}</span>{/if}
              {#if c.voltaStart}<span class="volta-label">{c.volta}</span>{/if}
              {#if c.section}<span class="sec">{c.section}</span>{/if}
              {#if c.sub}<span class="subname">{c.sub}</span>{/if}
              {#each c.chips as chip, i (i)}<span class="chip">{chip}</span>{/each}
            </button>
          {/if}
        {/each}
      </div>

      <div class="line ops">
        <label class="inline"><span class="muted small">{t('setup.count')}</span>
          <input class="count" type="number" min="1" max="500" bind:value={count} aria-label={t('setup.count')} />
        </label>
        <button class="btn small" disabled={!sel} onclick={() => insert('before')}>{t('setup.insertBefore')}</button>
        <button class="btn small" disabled={!sel} onclick={() => insert('after')}>{t('setup.insertAfter')}</button>
        <button class="btn small danger" disabled={!sel} onclick={remove}>{t('setup.delete')}</button>
        <button class="btn small toggle" class:on={extend} disabled={anchor === null} onclick={() => (extend = !extend)}>{t('setup.extend')}</button>
      </div>
    </div>

    <div class="card box">
      <h3>{t('setup.events')}</h3>
      {#if clearable.length > 0}
        <div class="line">
          {#each clearable as c (c.kind)}
            <button class="btn small danger" onclick={() => removeAll(c.kind, c.n)}>{t('setup.clearAll', { kind: kindLabel(c.kind), n: c.n })}</button>
          {/each}
        </div>
      {/if}
      <div class="lines">
        {#each events as e (e.id)}
          <div class="line" class:selected={app.selection?.kind === 'event' && app.selection.id === e.id} data-row-id={e.id} onfocusin={() => (app.selection = { kind: 'event', id: e.id })}>
            <span class="kind">{kindLabel(e.kind)}</span>
            <div class="n"><PosInput label={t('ev.pos')} value={e.pos} meter={meters} onchange={(v) => (e.pos = v)} /></div>
            {#if e.kind === 'meter'}
              <div class="n"><NumInput label={t('ev.beats')} min={1} max={32} value={e.beats} onchange={(v) => (e.beats = Math.max(1, Math.round(v ?? 4)))} /></div>
              <span>/</span>
              <select class="sel" aria-label={t('ev.unit')} bind:value={e.unit}>{#each unitOptions as u (u)}<option value={u}>{u}</option>{/each}</select>
            {:else if e.kind === 'repeat-end'}
              <label class="inline"><span class="muted small">{t('ev.times')}</span>
                <div class="n"><NumInput label={t('ev.times')} min={2} max={9} value={e.times} onchange={(v) => (e.times = Math.max(2, Math.round(v ?? 2)))} /></div>
              </label>
            {:else if e.kind === 'volta'}
              <div class="n"><PosInput label={t('ev.to')} value={e.to} meter={meters} onchange={(v) => (e.to = v)} /></div>
              <input class="k" type="text" aria-label={t('ev.endings')} value={e.numbers.join(',')}
                oninput={(ev) => { const nums = ev.currentTarget.value.split(/[,\s]+/).map((x) => parseInt(x, 10)).filter((x) => x > 0); if (nums.length) e.numbers = nums; }} />
            {:else if e.kind === 'section' || e.kind === 'subsection'}
              <input class="grow" type="text" aria-label={t('ev.name')} placeholder={t('ev.name')} bind:value={e.name} oninput={() => (e.term = '')} />
              {#if e.kind === 'section'}<label class="check"><input type="checkbox" bind:checked={e.shade} />{t('ev.shade')}</label>{/if}
            {:else if e.kind === 'marker' || e.kind === 'text'}
              <input class="grow" type="text" aria-label={t('ev.label')} placeholder={t('ev.label')} bind:value={e.label} oninput={() => (e.term = '')} />
              {#if e.kind === 'marker'}<label class="check"><input type="checkbox" bind:checked={e.line} />{t('ev.line')}</label>{/if}
            {:else if e.kind === 'barline'}
              <select class="sel" aria-label={t('ev.style')} bind:value={e.style}>
                <option value="double">{t('ev.double')}</option>
                <option value="final">{t('ev.final')}</option>
              </select>
            {:else if e.kind === 'keysig'}
              <div class="n"><NumInput label={t('ev.fifths')} min={-7} max={7} value={e.fifths} onchange={(v) => (e.fifths = Math.round(v ?? 0))} /></div>
            {/if}
            <button class="btn small icon danger" title={t('common.delete')} onclick={() => removeEvent(e.id)}>×</button>
          </div>
        {:else}
          <p class="muted small">{t('setup.noEvents')}</p>
        {/each}
      </div>
    </div>
  </section>

  <section class="side" class:hide={pane !== 'preview'}>
    <ChartPreview {piece} editable />
  </section>
</div>

<style>
  .layout {
    display: grid; gap: 16px; padding: 16px; max-width: 1600px; margin: 0 auto;
    grid-template-columns: minmax(360px, 640px) minmax(0, 1fr); align-items: start;
  }
  .main { display: grid; gap: 12px; min-width: 0; }
  .box { padding: 14px; display: grid; gap: 10px; }
  .structure > .box { padding-top: 0; }
  .row { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
  .meter { display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; align-items: center; max-width: 220px; }
  .inline { display: inline-flex; align-items: center; gap: 8px; }
  .inline :global(input[type='text']), .inline :global(input[type='number']) { width: 90px; }
  .inline select { width: auto; max-width: 100%; }
  @media (max-width: 700px) { .inline { display: flex; flex-wrap: wrap; width: 100%; } .inline select { flex: 1 1 200px; } }
  .spacer { flex: 1; }
  .palette { display: flex; flex-wrap: wrap; gap: 6px; }
  .palette .on, .line .on { background: var(--accent-soft); border-color: var(--accent); }
  .toolform { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding-top: 4px; }
  .toolform .grow { flex: 1 1 160px; }
  .terms { display: grid; gap: 8px; padding-top: 8px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { padding: 4px 12px; border-radius: 99px; border: 1px solid var(--border); background: var(--surface); cursor: pointer; font-weight: 500; }
  .chip:hover { border-color: var(--accent); background: var(--accent-soft); }
  .check { display: inline-flex; align-items: center; gap: 6px; font-size: 0.9rem; }
  .gridhead { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; flex-wrap: wrap; }
  .bars { display: grid; gap: 4px; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); }
  .cell {
    position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 1px; min-height: 62px; padding: 8px 6px 4px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; text-align: left; overflow: hidden;
    background-image: linear-gradient(var(--sec, transparent), var(--sec, transparent)), linear-gradient(var(--sub, transparent), var(--sub, transparent));
    background-size: 100% 4px, 100% 3px; background-position: top, 0 4px; background-repeat: no-repeat;
  }
  .cell.pickup { background: var(--surface-2); cursor: default; border-style: dashed; }
  .lines .line.selected { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 8px; background: var(--accent-soft); animation: pick 1.2s ease-out; }
  @keyframes pick { from { box-shadow: 0 0 0 6px var(--accent-soft); } to { box-shadow: 0 0 0 0 transparent; } }
  .cell.selected { outline: 2px solid var(--accent); outline-offset: -1px; background-color: var(--accent-soft); }
  .cell.rs { border-left: 4px double var(--text); }
  .cell.re { border-right: 4px double var(--text); }
  .cell.volta::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: var(--text); opacity: 0.55; }
  .num { font-size: 0.72rem; color: var(--muted); font-variant-numeric: tabular-nums; }
  .meter { font-weight: 700; font-size: 0.85rem; }
  .rep { font-weight: 700; font-size: 0.8rem; }
  .rep.end { align-self: flex-end; }
  .volta-label { font-size: 0.75rem; font-weight: 600; }
  .sec { font-size: 0.72rem; font-weight: 600; line-height: 1.1; overflow-wrap: anywhere; }
  .subname { font-size: 0.68rem; color: var(--muted); line-height: 1.1; overflow-wrap: anywhere; }
  .chip { font-size: 0.7rem; padding: 0 4px; border: 1px solid var(--border); border-radius: 4px; background: var(--surface-2); }
  .ops { gap: 8px; }
  .count { width: 64px; }
  .kind { flex: 0 0 120px; font-size: 0.85rem; font-weight: 600; }
  .side { min-width: 0; position: sticky; top: calc(var(--header-h) + var(--tabs-h) + 12px); }
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
