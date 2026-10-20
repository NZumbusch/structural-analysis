<script lang="ts">
  import AnalysisView from './lib/components/AnalysisView.svelte';
  import ExportView from './lib/components/ExportView.svelte';
  import LibraryView from './lib/components/LibraryView.svelte';
  import PieceView from './lib/components/PieceView.svelte';
  import SetupView from './lib/components/SetupView.svelte';
  import StatsView from './lib/components/StatsView.svelte';
  import { displayTitle } from './lib/domain/piece';
  import { onMount } from 'svelte';
  import { downloadBlob, projectBlob } from './lib/export/files';
  import { codeFromHash, decodePiece } from './lib/export/share';
  import { t, type TKey } from './lib/i18n/index.svelte';
  import { app, fingerprint, type Tab } from './lib/stores/app.svelte';

  const tabs: { id: Tab; icon: string }[] = [
    { id: 'library', icon: '▤' },
    { id: 'piece', icon: '✎' },
    { id: 'setup', icon: '▦' },
    { id: 'analysis', icon: '≣' },
    { id: 'stats', icon: '▥' },
    { id: 'export', icon: '⤓' },
  ];

  let fileInput: HTMLInputElement | undefined = $state();
  let dragging = $state(false);
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  const piece = $derived(app.piece);

  // Track history and autosave whenever the open piece changes.
  $effect(() => {
    if (!app.piece) return;
    const json = fingerprint(app.piece);
    app.track(json);
    app.saveState = 'saving';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => app.saveCurrent(), 400);
  });

  $effect(() => {
    document.documentElement.lang = app.prefs.uiLang;
    document.title = piece ? `${displayTitle(piece) || t('common.untitled')} · ${t('appName')}` : t('appName');
  });

  function importResult(ok: boolean, n: number) {
    return ok ? t('lib.imported', { n }) : t('lib.importFailed');
  }

  function onFiles(files: FileList | null) {
    if (files && files.length) void app.importFiles(files, importResult);
    if (fileInput) fileInput.value = '';
  }

  // A shared link carries the piece in the URL hash; open it as a new piece.
  onMount(() => {
    const code = codeFromHash(location.hash);
    if (!code) return;
    void decodePiece(code).then((shared) => {
      if (shared) {
        const [added] = app.importPieces([shared]);
        app.open(added, 'analysis');
        app.notify(t('lib.linkImported'));
      } else {
        app.notify(t('lib.linkFailed'));
      }
      history.replaceState(null, '', location.pathname + location.search);
    });
  });

  function onKeydown(e: KeyboardEvent) {
    const typing = (e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable]');
    if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && app.selection && app.tab !== 'library') {
      if (app.deleteSelection()) e.preventDefault();
      return;
    }
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || app.tab === 'library') return;
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'text'))) {
      // let the browser undo inside a text field first
      if (!e.shiftKey && el.dataset.nativeUndo !== 'off') return;
    }
    e.preventDefault();
    if (e.shiftKey) app.redo();
    else app.undo();
  }

  function go(tab: Tab) {
    if (tab !== 'library' && !app.piece) {
      app.tab = 'library';
      return;
    }
    app.tab = tab;
  }
</script>

<svelte:window
  onkeydown={onKeydown}
  ondragover={(e) => {
    e.preventDefault();
    dragging = true;
  }}
  ondragleave={(e) => {
    if (e.relatedTarget === null) dragging = false;
  }}
  ondrop={(e) => {
    e.preventDefault();
    dragging = false;
    onFiles(e.dataTransfer?.files ?? null);
  }}
/>

<input bind:this={fileInput} type="file" accept=".json,application/json" multiple hidden onchange={(e) => onFiles(e.currentTarget.files)} />

<header class="top">
  <div class="brand">
    <span class="logo" aria-hidden="true"></span>
    <strong>{t('appName')}</strong>
  </div>
  <div class="current">
    {#if piece}<span class="name">{displayTitle(piece) || t('common.untitled')}</span>{/if}
    {#if piece}
      <span class="state small" class:error={app.saveState === 'error'}>
        {app.saveState === 'saving' ? t('save.saving') : app.saveState === 'error' ? t('save.error') : '✓ ' + t('save.saved')}
      </span>
    {/if}
  </div>
  <div class="lang" role="group" aria-label="Language">
    <button class="btn small" class:on={app.prefs.uiLang === 'de'} onclick={() => app.setUiLang('de')}>DE</button>
    <button class="btn small" class:on={app.prefs.uiLang === 'en'} onclick={() => app.setUiLang('en')}>EN</button>
  </div>
</header>

<nav class="tabs" aria-label="Workflow">
  {#each tabs as tab (tab.id)}
    <button
      class="tab"
      class:active={app.tab === tab.id}
      class:disabled={tab.id !== 'library' && !piece}
      aria-current={app.tab === tab.id ? 'page' : undefined}
      onclick={() => go(tab.id)}
    >
      <span class="ico" aria-hidden="true">{tab.icon}</span>
      <span>{t(`tab.${tab.id}` as TKey)}</span>
    </button>
  {/each}
</nav>

{#if app.tab === 'library' || app.tab === 'analysis'}
  <div class="toolbar">
    {#if app.tab === 'library'}
      <button class="btn primary small" onclick={() => app.create()}>{t('lib.new')}</button>
      <button class="btn small" onclick={() => app.createExample()}>{t('lib.example')}</button>
      <button class="btn small" onclick={() => fileInput?.click()}>{t('lib.import')}</button>
      <button
        class="btn small"
        disabled={app.library.length === 0}
        onclick={() => downloadBlob(projectBlob(app.library), 'tonartenverlauf-backup.json')}>{t('lib.backup')}</button>
    {:else}
      <button class="btn small" disabled={!app.canUndo} onclick={() => app.undo()}>↶ {t('common.undo')}</button>
      <button class="btn small" disabled={!app.canRedo} onclick={() => app.redo()}>↷ {t('common.redo')}</button>
    {/if}
  </div>
{/if}

<main>
  {#if app.tab === 'library'}
    <LibraryView />
  {:else if piece}
    {#key piece.id}
      {#if app.tab === 'piece'}
        <PieceView {piece} />
      {:else if app.tab === 'setup'}
        <SetupView {piece} />
      {:else if app.tab === 'analysis'}
        <AnalysisView {piece} />
      {:else if app.tab === 'stats'}
        <StatsView {piece} />
      {:else}
        <ExportView {piece} />
      {/if}
    {/key}
  {/if}
</main>

{#if dragging}<div class="drop">{t('lib.drop')}</div>{/if}
{#if app.toast}
  <div class="toast" role="status">{app.toast === 'storage' ? t('save.error') : app.toast}</div>
{/if}

<style>
  .top {
    position: sticky; top: 0; z-index: 20; height: var(--header-h);
    display: flex; align-items: center; gap: 14px; padding: 0 16px;
    background: var(--surface); border-bottom: 1px solid var(--border);
  }
  .brand { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
  .logo { width: 22px; height: 22px; border-radius: 6px; background: linear-gradient(135deg, #9fe1cb 50%, #cecbf6 50%); border: 1.5px solid var(--accent); }
  .current { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.2; }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .state { color: var(--muted); }
  .state.error { color: var(--danger); }
  .lang { display: flex; gap: 4px; }
  .lang .on { background: var(--accent-soft); border-color: var(--accent); font-weight: 600; }

  .tabs {
    position: sticky; top: var(--header-h); z-index: 19; height: var(--tabs-h);
    display: flex; gap: 4px; padding: 0 12px; background: var(--surface); border-bottom: 1px solid var(--border);
  }
  .tab {
    display: inline-flex; align-items: center; gap: 8px; padding: 0 16px; background: none; border: 0;
    border-bottom: 3px solid transparent; cursor: pointer; color: var(--muted); font-weight: 500;
  }
  .tab:hover { color: var(--text); }
  .tab.active { color: var(--text); border-bottom-color: var(--accent); font-weight: 700; }
  .tab.disabled { opacity: 0.4; }
  .ico { font-size: 1.1rem; }

  .toolbar {
    position: sticky; top: calc(var(--header-h) + var(--tabs-h)); z-index: 18;
    display: flex; flex-wrap: wrap; gap: 8px; padding: 8px 16px;
    background: var(--surface-2); border-bottom: 1px solid var(--border);
  }

  .drop {
    position: fixed; inset: 0; z-index: 50; display: grid; place-items: center;
    background: color-mix(in srgb, var(--accent) 25%, transparent); border: 4px dashed var(--accent);
    font-size: 1.4rem; font-weight: 600; pointer-events: none;
  }
  .toast {
    position: fixed; left: 50%; bottom: calc(24px + env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 60;
    max-width: min(90vw, 480px); padding: 10px 16px; border-radius: 10px;
    background: var(--text); color: var(--bg); box-shadow: var(--shadow);
  }

  @media (max-width: 700px) {
    .tabs {
      position: fixed; top: auto; bottom: 0; left: 0; right: 0; height: calc(var(--tabs-h) + 8px + env(safe-area-inset-bottom));
      padding: 0 0 env(safe-area-inset-bottom); border-top: 1px solid var(--border); border-bottom: 0; justify-content: space-around;
    }
    .tab { flex: 1; flex-direction: column; gap: 0; justify-content: center; padding: 0; border-bottom: 0; border-top: 3px solid transparent; font-size: 0.75rem; }
    .tab.active { border-top-color: var(--accent); }
    .toolbar { top: var(--header-h); }
    main { padding-bottom: calc(var(--tabs-h) + 16px + env(safe-area-inset-bottom)); }
    .name { font-size: 0.9rem; }
  }
</style>
