<script lang="ts">
  import AnalysisView from './lib/components/AnalysisView.svelte';
  import ErrorScreen from './lib/components/ErrorScreen.svelte';
  import ExportView from './lib/components/ExportView.svelte';
  import LookView from './lib/components/LookView.svelte';
  import LibraryView from './lib/components/LibraryView.svelte';
  import PieceView from './lib/components/PieceView.svelte';
  import SetupView from './lib/components/SetupView.svelte';
  import StatsView from './lib/components/StatsView.svelte';
  import { displayTitle } from './lib/domain/piece';
  import { validate } from './lib/domain/validate';
  import { onMount } from 'svelte';
  import { codeFromHash, decodePiece } from './lib/export/share';
  import { t, type TKey } from './lib/i18n/index.svelte';
  import { app, fingerprint, type Tab } from './lib/stores/app.svelte';
  import AppMenu from './lib/components/AppMenu.svelte';
  import DcmlDialog from './lib/components/DcmlDialog.svelte';
  import SaveIndicator from './lib/components/SaveIndicator.svelte';
  import SettingsView from './lib/components/SettingsView.svelte';
  import { sync } from './lib/stores/sync.svelte';

  /** Tabs where the piece can be edited, so undo and redo show up in the header. */
  const EDITING: Tab[] = ['piece', 'setup', 'analysis', 'look'];
  const tabs: { id: Tab; icon: string }[] = [
    { id: 'library', icon: '▤' },
    { id: 'piece', icon: '✎' },
    { id: 'setup', icon: '▦' },
    { id: 'analysis', icon: '≣' },
    { id: 'stats', icon: '▥' },
    { id: 'look', icon: 'Aa' },
    { id: 'export', icon: '⤓' },
  ];

  let fileInput: HTMLInputElement | undefined = $state();
  let dragging = $state(false);
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  const piece = $derived(app.piece);
  /** Problems (not hints) per tab, shown as a small badge. */
  const badges = $derived.by(() => {
    const out: Partial<Record<Tab, number>> = {};
    if (!piece) return out;
    for (const i of validate(piece)) {
      if (i.severity === 'info') continue;
      const tab: Tab = i.target?.kind === 'event' ? 'setup' : 'analysis';
      out[tab] = (out[tab] ?? 0) + 1;
    }
    return out;
  });

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
    sync.init();
    const tick = setInterval(() => {
      sync.refresh();
    }, 60_000);
    const code = codeFromHash(location.hash);
    if (!code) return () => clearInterval(tick);
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
    return () => clearInterval(tick);
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

<svelte:boundary>
<input bind:this={fileInput} type="file" accept=".json,application/json" multiple hidden onchange={(e) => onFiles(e.currentTarget.files)} />

<header class="top">
  <AppMenu onImportFile={() => fileInput?.click()} />
  <div class="current">
    {#if piece}
      <span class="name">{displayTitle(piece) || t('common.untitled')}</span>
      <SaveIndicator />
      {#if EDITING.includes(app.tab)}
        <span class="history" role="group" aria-label={t('common.undo')}>
          <button class="btn small icon" disabled={!app.canUndo} title={`${t('common.undo')} (Strg/Cmd+Z)`} aria-label={t('common.undo')} onclick={() => app.undo()}>↶</button>
          <button class="btn small icon" disabled={!app.canRedo} title={`${t('common.redo')} (Strg/Cmd+Shift+Z)`} aria-label={t('common.redo')} onclick={() => app.redo()}>↷</button>
        </span>
      {/if}
    {/if}
  </div>
  <button class="btn small icon gear" class:on={app.settingsOpen} aria-label={t('set.title')} aria-expanded={app.settingsOpen} title={t('set.title')} onclick={() => (app.settingsOpen = !app.settingsOpen)}>
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
  </button>
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
      <span class="full">{t(`tab.${tab.id}` as TKey)}</span><span class="short">{t(`tab.${tab.id}.short` as TKey)}</span>
      {#if badges[tab.id]}<span class="badge" title={t('val.title')}>{badges[tab.id]}</span>{/if}
    </button>
  {/each}
</nav>

{#if sync.status === 'signed-out' && app.prefs.sync.enabled}
  <div class="backupbar">
    <span>{t('sync.bar')}</span>
    <button class="btn small" onclick={() => sync.signIn()}>{t('sync.signIn')}</button>
  </div>
{/if}

{#if app.tab === 'library'}
  <div class="toolbar">
    <button class="btn primary small" onclick={() => app.create()}>{t('lib.new')}</button>
    <button class="btn small" onclick={() => app.createExample()}>{t('lib.example')}</button>
    <button class="btn small" onclick={() => fileInput?.click()}>{t('lib.import')}</button>
    {#if app.installEvent}
      <button class="btn small" onclick={() => app.install()}>⤓ {t('install.button')}</button>
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
      {:else if app.tab === 'look'}
        <LookView {piece} />
      {:else}
        <ExportView {piece} />
      {/if}
    {/key}
  {/if}
</main>

{#if app.settingsOpen}<SettingsView />{/if}
{#if app.dcmlOpen}<DcmlDialog />{/if}

{#if dragging}<div class="drop">{t('lib.drop')}</div>{/if}
{#if app.toast}
  <div class="toast" role="status">{app.toast === 'storage' ? t('save.error') : app.toast}</div>
{/if}

  {#snippet failed(error, reset)}
    <ErrorScreen {error} {reset} />
  {/snippet}
</svelte:boundary>

<style>
  .top {
    position: sticky; top: 0; z-index: 20; height: var(--header-h);
    display: flex; align-items: center; gap: 14px; padding: 0 16px;
    background: var(--surface); border-bottom: 1px solid var(--border);
  }
  .current { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; line-height: 1.2; }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .backupbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 6px 16px; font-size: 0.85rem; background: var(--accent-soft); border-bottom: 1px solid var(--border); }
  .backupbar span { flex: 1 1 200px; }
  .history { display: inline-flex; gap: 4px; flex: none; margin-left: 4px; }
  .gear.on { background: var(--accent-soft); border-color: var(--accent); }

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
  .tab .short { display: none; }
  .badge { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--danger); color: #fff; font-size: 0.7rem; font-weight: 700; line-height: 18px; text-align: center; }

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
    .tab { flex: 1 1 0; min-width: 0; flex-direction: column; gap: 0; justify-content: center; align-items: center; padding: 0 2px; border-bottom: 0; border-top: 3px solid transparent; font-size: 0.62rem; position: relative; }
    .tab .full { display: none; }
    .tab .short { display: inline; }
    .tab span:not(.ico):not(.badge) { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .badge { position: absolute; top: 2px; right: 6px; min-width: 16px; height: 16px; line-height: 16px; font-size: 0.62rem; }
    .tab.active { border-top-color: var(--accent); }
    .toolbar { top: var(--header-h); }
    main { padding-bottom: calc(var(--tabs-h) + 16px + env(safe-area-inset-bottom)); }
    .name { font-size: 0.9rem; }
  }
</style>
