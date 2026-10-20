<script lang="ts" generics="T">
  import { toCsv, toTsv, type Column } from '../analysis/csv';
  import { downloadBlob } from '../export/files';
  import { app } from '../stores/app.svelte';
  import { t } from '../i18n/index.svelte';

  let {
    columns,
    rows,
    name,
    sort = null,
  }: { columns: Column<T>[]; rows: T[]; name: string; sort?: string | null } = $props();

  let sortKey = $state<string | null>(null);
  let dir = $state<1 | -1>(1);

  const active = $derived(sortKey ?? sort);
  const sorted = $derived.by(() => {
    const col = columns.find((c) => c.key === active);
    if (!col) return rows;
    return [...rows].sort((a, b) => {
      const x = col.value(a);
      const y = col.value(b);
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), app.prefs.uiLang);
      return r * dir;
    });
  });

  function toggle(key: string) {
    if (active === key) dir = dir === 1 ? -1 : 1;
    else {
      sortKey = key;
      dir = 1;
    }
  }

  const csv = () => downloadBlob(new Blob([toCsv(columns, sorted, app.prefs.uiLang)], { type: 'text/csv;charset=utf-8' }), `${name}.csv`);
  async function copy() {
    try {
      await navigator.clipboard.writeText(toTsv(columns, sorted));
      app.notify(t('stats.copied'));
    } catch {
      app.notify(t('ex.copyFailed'));
    }
  }
</script>

<div class="wrap">
  <div class="scroll">
    <table>
      <thead>
        <tr>
          {#each columns as c (c.key)}
            <th class:right={c.align === 'right'} aria-sort={active === c.key ? (dir === 1 ? 'ascending' : 'descending') : 'none'}>
              <button onclick={() => toggle(c.key)}>
                {c.label}<span class="arrow" aria-hidden="true">{active === c.key ? (dir === 1 ? '▲' : '▼') : ''}</span>
              </button>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each sorted as row, i (i)}
          <tr>
            {#each columns as c (c.key)}
              <td class:right={c.align === 'right'}>{c.text ? c.text(row) : c.value(row)}</td>
            {/each}
          </tr>
        {:else}
          <tr><td colspan={columns.length} class="muted">{t('an.empty')}</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
  <div class="line">
    <button class="btn small" onclick={csv} disabled={rows.length === 0}>{t('stats.csv')}</button>
    <button class="btn small" onclick={copy} disabled={rows.length === 0}>{t('stats.copy')}</button>
  </div>
</div>

<style>
  .wrap { display: grid; gap: 8px; min-width: 0; }
  .scroll { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; }
  table { border-collapse: collapse; width: 100%; font-size: 0.9rem; font-variant-numeric: tabular-nums; }
  th, td { padding: 6px 10px; text-align: left; white-space: nowrap; border-bottom: 1px solid var(--border); }
  tbody tr:last-child td { border-bottom: 0; }
  th { background: var(--surface-2); font-weight: 600; padding: 0; }
  th button { all: unset; display: block; box-sizing: border-box; width: 100%; padding: 6px 10px; cursor: pointer; }
  th button:hover { color: var(--accent); }
  th button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .right, th.right button { text-align: right; }
  .arrow { display: inline-block; width: 1.2em; font-size: 0.7em; color: var(--accent); }
  tbody tr:hover td { background: var(--surface-2); }
</style>
