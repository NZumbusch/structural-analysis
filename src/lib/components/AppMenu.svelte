<script lang="ts">
  import { APP_VERSION } from '../export/stamp';
  import { t } from '../i18n/index.svelte';
  import { app } from '../stores/app.svelte';

  let { onImportFile }: { onImportFile: () => void } = $props();

  let open = $state(false);
  let root: HTMLElement | undefined = $state();
  let list: HTMLElement | undefined = $state();

  function items(): HTMLElement[] {
    return list ? Array.from(list.querySelectorAll<HTMLElement>('[role=menuitem]:not([disabled])')) : [];
  }

  function toggle() {
    open = !open;
    if (open) queueMicrotask(() => items()[0]?.focus());
  }

  /** Runs an entry and closes the menu. */
  function run(fn: () => void) {
    open = false;
    fn();
  }

  function onWindowClick(e: MouseEvent) {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }

  function onKey(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') {
      open = false;
      (root?.querySelector('.trigger') as HTMLElement | null)?.focus();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const all = items();
    const i = all.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? (i + 1) % all.length : (i - 1 + all.length) % all.length;
    all[next]?.focus();
  }
</script>

<svelte:window onclick={onWindowClick} onkeydown={onKey} />

<div class="menu" bind:this={root}>
  <button class="trigger" aria-haspopup="menu" aria-expanded={open} onclick={toggle}>
    <span class="logo" aria-hidden="true"></span>
    <strong>{t('appName')}</strong>
    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
  </button>

  {#if open}
    <div class="drop" role="menu" aria-label={t('appName')} bind:this={list}>
      <button role="menuitem" onclick={() => run(() => (app.tab = 'library'))}>{t('menu.library')}</button>
      {#if app.piece && app.tab === 'library'}<button role="menuitem" onclick={() => run(() => (app.tab = 'analysis'))}>{t('lib.back')}</button>{/if}
      <hr />
      <button role="menuitem" disabled={!app.canUndo} onclick={() => run(() => app.undo())}>{t('common.undo')}</button>
      <button role="menuitem" disabled={!app.canRedo} onclick={() => run(() => app.redo())}>{t('common.redo')}</button>
      <hr />
      <button role="menuitem" onclick={() => run(() => app.create())}>{t('lib.new')}</button>
      <button role="menuitem" onclick={() => run(() => app.createExample())}>{t('lib.example')}</button>
      <hr />
      <button role="menuitem" onclick={() => run(onImportFile)}>{t('menu.import')}</button>
      {#if !app.simple}<button role="menuitem" onclick={() => run(() => (app.dcmlOpen = true))}>{t('menu.dcml')}</button>{/if}
      <hr />
      <button role="menuitem" disabled={!app.piece} onclick={() => run(() => app.piece && app.saveProjectFile([app.piece]))}>{t('menu.saveOne')}</button>
      <button role="menuitem" disabled={app.library.length === 0} onclick={() => run(() => app.saveProjectFile(app.library, 'tonartenverlauf-backup.json'))}>{t('lib.backup')}</button>
      <hr />
      {#if app.installEvent}<button role="menuitem" onclick={() => run(() => app.install())}>{t('install.button')}</button>{/if}
      <button role="menuitem" onclick={() => run(() => (app.settingsOpen = true))}>{t('set.title')} …</button>
      <hr />
      <a role="menuitem" href="./privacy.html" target="_blank" rel="noopener" onclick={() => (open = false)}>{t('about.privacy')}</a>
      <a role="menuitem" href="./licenses/Inter-OFL.txt" target="_blank" rel="noopener" onclick={() => (open = false)}>{t('about.fonts')}</a>
      <p class="ver">{t('appName')} {APP_VERSION} · {t('about.license')}</p>
    </div>
  {/if}
</div>

<style>
  .menu { position: relative; flex: none; }
  .trigger {
    display: inline-flex; align-items: center; gap: 8px; padding: 4px 8px; margin-left: -8px; border: 0; border-radius: 8px;
    background: transparent; cursor: pointer; white-space: nowrap;
  }
  .trigger:hover, .trigger[aria-expanded='true'] { background: var(--surface-2); }
  .trigger svg { color: var(--muted); }
  .logo { width: 22px; height: 22px; border-radius: 6px; background: linear-gradient(135deg, #9fe1cb 50%, #cecbf6 50%); border: 1.5px solid var(--accent); }
  .drop {
    position: absolute; z-index: 40; top: calc(100% + 6px); left: -8px; min-width: 300px; padding: 6px;
    display: grid; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.16);
  }
  .drop button, .drop a {
    display: block; width: 100%; text-align: left; padding: 8px 12px; border: 0; border-radius: 6px; background: transparent;
    color: inherit; text-decoration: none; cursor: pointer; font-size: 0.95rem;
  }
  .drop button:hover:not(:disabled), .drop a:hover, .drop button:focus-visible, .drop a:focus-visible { background: var(--accent-soft); outline: none; }
  .drop button:disabled { opacity: 0.45; cursor: default; }
  hr { border: 0; border-top: 1px solid var(--border); margin: 4px 6px; width: calc(100% - 12px); }
  .ver { margin: 4px 12px 2px; font-size: 0.78rem; color: var(--muted); }
  @media (max-width: 700px) {
    .menu { position: static; }
    .drop { position: fixed; top: calc(var(--header-h) + 4px); left: 8px; right: 8px; min-width: 0; max-height: calc(100vh - var(--header-h) - 16px); overflow-y: auto; }
  }
</style>
