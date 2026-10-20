<script lang="ts">
  import { keyFromRow } from '../domain/keys';
  import { snapPos, snapUnit, meterAt, type Snap } from '../domain/positions';
  import { meterMap, startPos } from '../domain/structure';
  import type { Piece, Segment } from '../domain/types';
  import { renderChart } from '../render/chart';
  import { app } from '../stores/app.svelte';
  import { t } from '../i18n/index.svelte';

  let { piece, editable = false }: { piece: Piece; editable?: boolean } = $props();

  let full = $state(false);
  let sheetEl: HTMLElement | undefined = $state();
  let sheetWidth = $state(0);

  const view = $derived(piece.views.find((v) => v.id === app.activeViewId) ?? null);
  const range = $derived(view ? { from: view.from, to: view.to } : null);
  // Play-order layouts are derived copies, so there is nothing to edit directly in them.
  const interactive = $derived(editable && app.editInPreview && piece.style.repeatDisplay === 'symbols');

  // Handles stay about 14 px wide on screen however far the chart is scaled down.
  const baseWidth = $derived(renderChart(piece, { view: range }).width);
  const scale = $derived(full || !sheetWidth ? 1 : sheetWidth / baseWidth);
  const handle = $derived(Math.min(40, Math.max(6, 14 / scale)));

  const chart = $derived(
    renderChart(piece, {
      view: range,
      interactive: interactive ? { handle, selected: app.selection?.id ?? null } : undefined,
    }),
  );
  const transparent = $derived(piece.style.transparentBackground);

  // ---- dragging -------------------------------------------------------------------------------
  type Drag =
    | { kind: 'edge'; id: string; edge: 'from' | 'to'; linked: Segment[] }
    | { kind: 'passing'; id: string }
    | { kind: 'annotation'; id: string; x: number; y: number; dx: number; dy: number };
  let drag: Drag | null = null;

  function point(e: PointerEvent): { x: number; y: number } | null {
    const svg = sheetEl?.querySelector('svg');
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }

  const posAt = (x: number) => chart.geometry.from + (x - chart.geometry.left) / chart.geometry.ppb;
  function rowAt(y: number): number {
    const g = chart.geometry;
    const row = g.topRow - Math.round((y - g.firstRowY) / g.rowHeight);
    return Math.max(g.bottomRow, Math.min(g.topRow, row));
  }

  function onpointerdown(e: PointerEvent) {
    if (!interactive) return;
    const el = (e.target as Element).closest<SVGElement>('[data-kind]');
    if (!el) {
      app.selection = null;
      return;
    }
    const kind = el.dataset.kind as 'segment' | 'passing' | 'annotation';
    const id = el.dataset.id!;
    app.selection = { kind, id };
    if (e.button !== 0) return;
    const pt = point(e);
    if (!pt) return;

    if (kind === 'segment' && el.dataset.handle) {
      const seg = piece.segments.find((s) => s.id === id);
      if (!seg) return;
      const edge = el.dataset.handle as 'from' | 'to';
      // Neighbours that touch this edge move with it, unless Alt is held.
      const linked = e.altKey
        ? []
        : piece.segments.filter((o) => o.id !== id && Math.abs(edge === 'from' ? o.to - seg.from : o.from - seg.to) < 1e-9);
      drag = { kind: 'edge', id, edge, linked };
    } else if (kind === 'passing') {
      drag = { kind: 'passing', id };
    } else if (kind === 'annotation') {
      const a = piece.annotations.find((x) => x.id === id);
      if (!a) return;
      drag = { kind: 'annotation', id, x: pt.x, y: pt.y, dx: a.dx, dy: a.dy };
    } else {
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onpointermove(e: PointerEvent) {
    if (!drag) return;
    const pt = point(e);
    if (!pt) return;
    const meters = meterMap(piece);
    const snap: Snap = app.snap;
    const raw = posAt(pt.x);
    const unit = snapUnit(snap, meterAt(meters, Math.floor(raw)));
    const snapped = snapPos(raw, snap, meters, startPos(piece));

    if (drag.kind === 'edge') {
      const seg = piece.segments.find((s) => s.id === drag!.id);
      if (!seg) return;
      if (drag.edge === 'from') {
        const lower = Math.max(startPos(piece), ...drag.linked.map((o) => o.from + unit));
        const v = Math.max(lower, Math.min(snapped, seg.to - unit));
        seg.from = v;
        for (const o of drag.linked) o.to = v;
      } else {
        const upper = Math.min(Infinity, ...drag.linked.map((o) => o.to - unit));
        const v = Math.min(upper, Math.max(snapped, seg.from + unit));
        seg.to = v;
        for (const o of drag.linked) o.from = v;
      }
    } else if (drag.kind === 'passing') {
      const p = piece.passing.find((x) => x.id === drag!.id);
      if (!p) return;
      p.pos = snapped;
      p.key = keyFromRow(rowAt(pt.y), p.key.mode);
    } else {
      const a = piece.annotations.find((x) => x.id === drag!.id);
      if (!a) return;
      a.dx = Math.round(drag.dx + pt.x - drag.x);
      a.dy = Math.round(drag.dy + pt.y - drag.y);
    }
  }

  function onpointerup(e: PointerEvent) {
    if (!drag) return;
    drag = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  }
</script>

<div class="preview">
  <div class="bar">
    {#if piece.views.length > 0}
      <select class="view" aria-label={t('an.views')} bind:value={app.activeViewId}>
        <option value={null}>{t('view.whole')}</option>
        {#each piece.views as v (v.id)}
          <option value={v.id}>{v.name}</option>
        {/each}
      </select>
    {/if}
    {#if editable}
      <button class="btn small" class:on={app.editInPreview} title={t('view.editHint')} onclick={() => (app.editInPreview = !app.editInPreview)}>
        ✎ {t('view.edit')}
      </button>
      {#if app.editInPreview}
        <select class="snap" aria-label={t('view.snap')} title={t('view.snap')} bind:value={app.snap}>
          <option value="bar">{t('view.snapBar')}</option>
          <option value="beat">{t('view.snapBeat')}</option>
          <option value="half">{t('view.snapHalf')}</option>
        </select>
      {/if}
    {/if}
    <span class="spacer"></span>
    <button class="btn small" class:on={!full} onclick={() => (full = false)}>{t('view.fit')}</button>
    <button class="btn small" class:on={full} onclick={() => (full = true)}>{t('view.full')}</button>
  </div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="scroller"
    class:transparent
    class:editing={interactive}
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    onpointercancel={onpointerup}
  >
    <div
      class="sheet"
      bind:this={sheetEl}
      bind:clientWidth={sheetWidth}
      style:width={full ? `${chart.width}px` : '100%'}
      style:max-width={full ? 'none' : `${chart.width * 1.6}px`}
    >
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- generated by our own renderer, all text is escaped -->
      {@html chart.svg}
    </div>
  </div>
  {#if interactive}<p class="hint">{t('view.dragHint')}</p>{/if}
</div>

<style>
  .preview { display: grid; gap: 8px; min-width: 0; }
  .bar { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .bar .on { background: var(--accent-soft); border-color: var(--accent); }
  .bar select { width: auto; min-height: 32px; padding: 2px 8px; }
  .spacer { flex: 1; }
  .scroller {
    overflow: auto; border: 1px solid var(--border); border-radius: var(--radius); background: #fff; box-shadow: var(--shadow);
  }
  .scroller.transparent {
    background-color: #fff;
    background-image: conic-gradient(#e6e6e6 25%, transparent 0 50%, #e6e6e6 0 75%, transparent 0);
    background-size: 16px 16px;
  }
  .scroller.editing { user-select: none; -webkit-user-select: none; }
  .scroller.editing :global([data-kind]) { touch-action: none; }
  .sheet { margin: 0 auto; }
  .sheet :global(svg) { display: block; width: 100%; height: auto; }
</style>
