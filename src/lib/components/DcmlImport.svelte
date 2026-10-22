<script lang="ts">
  import { DEFAULT_STYLE, normalizeStyle } from '../domain/piece';
  import { convertDcml, DEFAULT_DCML_OPTIONS, type DcmlInput, type DcmlOptions, type DcmlResult, type WarningCode } from '../import/dcml/convert';
  import { groupFiles, listCorpora, listPieces, loadPiece, parseRepoRef, type Corpus, type RepoRef } from '../import/dcml/source';
  import { t, type TKey } from '../i18n/index.svelte';
  import { app } from '../stores/app.svelte';

  interface Item {
    id: string;
    title: string;
    sub: string;
    load: () => Promise<DcmlInput>;
  }

  const OPTIONS: (keyof DcmlOptions)[] = ['repeats', 'meters', 'keysigs', 'barlines', 'tonicizations', 'cadences', 'attribution'];

  let repoText = $state('');
  let corpora: Corpus[] = $state([]);
  let items: Item[] = $state([]);
  let selected: Record<string, boolean> = $state({});
  let filter = $state('');
  let options: DcmlOptions = $state({ ...DEFAULT_DCML_OPTIONS });
  let busy = $state('');
  let error = $state('');
  let report: { title: string; result?: DcmlResult; error?: string }[] = $state([]);
  let fileInput: HTMLInputElement | undefined = $state();

  const shown = $derived(items.filter((i) => `${i.id} ${i.title} ${i.sub}`.toLowerCase().includes(filter.trim().toLowerCase())));
  const chosen = $derived(items.filter((i) => selected[i.id]));

  async function loadCorpora() {
    error = '';
    busy = t('dcml.loadingList');
    try {
      corpora = await listCorpora();
      if (corpora.length === 0) error = t('dcml.errNet');
    } catch {
      error = t('dcml.errNet');
    }
    busy = '';
  }

  let repo: RepoRef | null = null;

  async function loadRepo() {
    error = '';
    report = [];
    const ref = parseRepoRef(repoText);
    if (!ref) {
      error = t('dcml.errUrl');
      return;
    }
    busy = t('dcml.loadingList');
    try {
      const entries = await listPieces(ref);
      if (entries.length === 0) error = t('dcml.errNoMeta');
      repo = ref;
      selected = {};
      items = entries.map((e) => ({
        id: e.piece,
        title: [e.composer, e.title].filter(Boolean).join(' · '),
        sub: [e.key && `${e.key}`, e.bars && t('dcml.bars', { n: e.bars }), e.labels > 0 ? t('dcml.labels', { n: e.labels }) : ''].filter(Boolean).join(' · '),
        load: () => loadPiece(ref, e),
      }));
    } catch {
      error = t('dcml.errNet');
    }
    busy = '';
  }

  async function pickFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    error = '';
    report = [];
    const picked = await Promise.all(Array.from(files).map(async (f) => ({ name: f.name, text: await f.text() })));
    const { inputs } = groupFiles(picked);
    if (inputs.length === 0) {
      error = t('dcml.errNoFiles');
      return;
    }
    repo = null;
    selected = {};
    items = inputs.map((input) => ({
      id: input.piece,
      title: input.metadata?.workTitle ?? '',
      sub: input.measures ? '' : t('dcml.noMeasures'),
      load: async () => input,
    }));
    for (const i of items) selected[i.id] = true;
    if (fileInput) fileInput.value = '';
  }

  function setAll(on: boolean) {
    const next = { ...selected };
    for (const i of shown) next[i.id] = on;
    selected = next;
  }

  async function run() {
    const style = app.prefs.defaultStyle ? normalizeStyle(app.prefs.defaultStyle) : DEFAULT_STYLE;
    const todo = chosen;
    const pieces = [];
    report = [];
    for (const [n, item] of todo.entries()) {
      busy = t('dcml.running', { done: n, n: todo.length });
      try {
        const result = convertDcml(await item.load(), { ...options }, app.prefs.uiLang, style);
        pieces.push(result.piece);
        report.push({ title: item.id, result });
      } catch (e) {
        report.push({ title: item.id, error: e instanceof Error && e.message === 'missing-harmonies' ? t('dcml.errMissing') : t('dcml.errNet') });
      }
    }
    busy = '';
    if (pieces.length === 0) return;
    const added = app.importPieces(pieces);
    app.notify(t('dcml.done', { n: added.length }));
    if (added.length === 1) {
      app.open(added[0], 'analysis');
      app.dcmlOpen = false;
    }
  }

  const summary = (r: DcmlResult) => t('dcml.summary', { bars: r.counts.bars, keys: r.counts.keys, rep: r.counts.repeats, end: r.counts.endings });
  const warning = (code: WarningCode, arg?: string) => t(`dcml.w.${code}` as TKey, { arg: arg ?? '' });
</script>

<div class="box">
    <p class="muted small">{t('dcml.intro')}</p>

    <div class="field">
      <span>{t('dcml.repo')}</span>
      <div class="line">
        <input class="grow" type="text" placeholder="github.com/DCMLab/mozart_piano_sonatas" bind:value={repoText} onkeydown={(e) => e.key === 'Enter' && loadRepo()} />
        <button class="btn" disabled={!repoText.trim() || !!busy} onclick={loadRepo}>{t('dcml.load')}</button>
      </div>
      <div class="line">
        {#if corpora.length === 0}
          <button class="btn small" disabled={!!busy} onclick={loadCorpora}>{t('dcml.corporaLoad')}</button>
        {:else}
          <select class="grow" onchange={(e) => { repoText = e.currentTarget.value; e.currentTarget.selectedIndex = 0; void loadRepo(); }}>
            <option value="">{t('dcml.corpora')}</option>
            {#each corpora as c (c.repo)}<option value={`${c.owner}/${c.repo}`}>{c.repo}</option>{/each}
          </select>
        {/if}
        <button class="btn small" onclick={() => fileInput?.click()}>{t('dcml.files')}</button>
        <input bind:this={fileInput} class="sr-only" type="file" accept=".tsv,text/tab-separated-values" multiple onchange={(e) => pickFiles(e.currentTarget.files)} />
      </div>
      <span class="hint">{t('dcml.filesHint')}</span>
    </div>

    {#if busy}<p class="muted small" role="status">{busy}</p>{/if}
    {#if error}<p class="err" role="alert">{error}</p>{/if}

    {#if items.length > 0}
      <div class="field">
        <div class="line">
          <input class="grow" type="text" placeholder={t('dcml.filter')} bind:value={filter} />
          <button class="btn small" onclick={() => setAll(true)}>{t('dcml.all')}</button>
          <button class="btn small" onclick={() => setAll(false)}>{t('dcml.none')}</button>
        </div>
        <ul class="pieces">
          {#each shown as i (i.id)}
            <li>
              <label class="check">
                <input type="checkbox" bind:checked={selected[i.id]} />
                <span class="name"><strong>{i.id}</strong>{#if i.title}&ensp;<span class="muted">{i.title}</span>{/if}{#if i.sub}<span class="muted small">&ensp;· {i.sub}</span>{/if}</span>
              </label>
            </li>
          {/each}
        </ul>
      </div>

      <fieldset class="opts">
        <legend>{t('dcml.details')}</legend>
        <p class="muted small">{t('dcml.keyPath')}</p>
        {#each OPTIONS as o (o)}
          <label class="check"><input type="checkbox" bind:checked={options[o]} />{t(`dcml.o.${o}` as TKey)}</label>
        {/each}
      </fieldset>

      <div class="line">
        <button class="btn primary" disabled={chosen.length === 0 || !!busy} onclick={run}>{t('dcml.import', { n: chosen.length })}</button>
      </div>
      <p class="hint">{t('dcml.license')}</p>
    {/if}

    {#if report.length > 0}
      <ul class="report">
        {#each report as r (r.title)}
          <li>
            <strong>{r.title}</strong>
            {#if r.result}
              <span class="muted small">{summary(r.result)}</span>
              {#each r.result.warnings as w, n (n)}<span class="warn small">{warning(w.code, w.arg)}</span>{/each}
            {:else}
              <span class="err">{r.error}</span>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
</div>

<style>
  .box { display: grid; gap: 12px; }
  .pieces { list-style: none; margin: 0; padding: 4px 8px; display: grid; gap: 2px; max-height: 280px; overflow: auto; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
  .check { display: flex; align-items: flex-start; gap: 8px; font-size: 0.9rem; padding: 3px 0; }
  .check input { flex: none; margin-top: 2px; }
  .name { min-width: 0; overflow-wrap: anywhere; }
  .opts { display: grid; gap: 4px; margin: 0; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; }
  .opts legend { font-size: 0.85rem; color: var(--muted); padding: 0 4px; }
  .report { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .report li { display: grid; gap: 2px; }
  .warn { color: var(--muted); }
</style>
