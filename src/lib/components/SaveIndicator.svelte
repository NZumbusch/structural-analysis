<script lang="ts">
  import { t, type TKey } from '../i18n/index.svelte';
  import { app } from '../stores/app.svelte';
  import { sync } from '../stores/sync.svelte';

  type Mode = 'busy' | 'synced' | 'pending' | 'local' | 'paused' | 'error' | 'save-error';

  let open = $state(false);
  let root: HTMLElement | undefined = $state();

  const mode = $derived.by((): Mode => {
    const piece = app.piece;
    if (app.saveState === 'error') return 'save-error';
    if (app.saveState === 'saving' || sync.status === 'syncing') return 'busy';
    if (!app.prefs.sync.enabled) return 'local';
    if (sync.status === 'signed-out') return 'paused';
    if (sync.status === 'error') return 'error';
    const stored = piece ? app.library.find((p) => p.id === piece.id) : null;
    const done = piece ? app.prefs.sync.files[piece.id] : undefined;
    return stored && done && done.syncedAt >= stored.updatedAt ? 'synced' : 'pending';
  });

  const time = $derived(
    app.prefs.sync.lastSync ? new Date(app.prefs.sync.lastSync).toLocaleTimeString(app.prefs.uiLang, { timeStyle: 'short' }) : '',
  );
  const label = $derived(t(`ind.${mode}` as TKey));

  function onWindowClick(e: MouseEvent) {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }

  function act(fn: () => void) {
    open = false;
    fn();
  }
</script>

<svelte:window onclick={onWindowClick} onkeydown={(e) => e.key === 'Escape' && (open = false)} />

<span class="wrap" bind:this={root}>
  <button class="ind {mode}" aria-label={label} aria-expanded={open} title={label} onclick={() => (open = !open)}>
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {#if mode === 'busy'}
        <g class="spin"><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></g>
      {:else if mode === 'synced'}
        <path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5Z" /><path d="m9 13 2.2 2.2L15.5 11" />
      {:else if mode === 'pending'}
        <path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5Z" /><path d="M12 16v-5m0 0-2 2m2-2 2 2" />
      {:else if mode === 'local'}
        <path d="M4 4v16h16V8l-4-4Z" /><path d="M8 4v5h7V4M8 20v-6h8v6" />
      {:else}
        <path d="M12 3 2.5 20h19Z" /><path d="M12 10v4.5M12 17.5v.1" />
      {/if}
    </svg>
  </button>

  {#if open}
    <div class="pop" role="status">
      <strong>{label}</strong>
      <p>{t(`ind.${mode}.text` as TKey, { time })}</p>
      {#if time && app.prefs.sync.enabled && mode !== 'busy'}<p class="muted">{t('ind.last', { time })}</p>{/if}
      <div class="actions">
        {#if mode === 'local'}
          <button class="btn small primary" onclick={() => act(() => (app.settingsOpen = true))}>{t('ind.setup')}</button>
          {#if app.piece}<button class="btn small" onclick={() => act(() => app.saveProjectFile([app.piece!]))}>{t('backup.save')}</button>{/if}
        {:else if mode === 'paused'}
          <button class="btn small primary" onclick={() => act(() => void sync.signIn())}>{t('sync.signIn')}</button>
        {:else if mode === 'pending' || mode === 'error' || mode === 'synced'}
          <button class="btn small primary" onclick={() => act(() => void sync.syncNow())}>{t('sync.now')}</button>
        {:else if mode === 'save-error' && app.piece}
          <button class="btn small primary" onclick={() => act(() => app.saveProjectFile([app.piece!]))}>{t('backup.save')}</button>
        {/if}
      </div>
    </div>
  {/if}
</span>

<style>
  .wrap { position: relative; flex: none; display: inline-flex; }
  .ind {
    display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; padding: 0;
    border: 0; border-radius: 8px; background: transparent; color: var(--muted); cursor: pointer;
  }
  .ind:hover { background: var(--surface-2); }
  .ind:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .ind.synced { color: var(--accent); }
  .ind.paused, .ind.pending { color: #a6670a; }
  .ind.error, .ind.save-error { color: var(--danger); }
  .spin { transform-origin: 12px 12px; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
  .pop {
    position: absolute; z-index: 40; top: 36px; left: -8px; width: min(300px, calc(100vw - 32px));
    display: grid; gap: 6px; padding: 12px 14px; background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14); font-size: 0.9rem; line-height: 1.4;
  }
  .pop p { margin: 0; }
  @media (max-width: 700px) {
    /* phones: as wide as the screen allows, under the top bar */
    .wrap { position: static; }
    .pop { position: fixed; top: calc(var(--header-h) + 6px); left: 16px; right: 16px; width: auto; }
  }
  .actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
</style>
