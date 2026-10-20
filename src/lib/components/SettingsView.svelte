<script lang="ts">
  import { onMount } from 'svelte';
  import { APP_VERSION } from '../export/stamp';
  import { t } from '../i18n/index.svelte';
  import { app } from '../stores/app.svelte';
  import SyncPanel from './SyncPanel.svelte';

  let closeButton: HTMLButtonElement | undefined = $state();
  onMount(() => closeButton?.focus());

  const close = () => (app.settingsOpen = false);
  const defaults = $derived(app.defaults);

  function saveLook() {
    app.saveDefaultStyle();
    app.notify(t('ex.defaultSaved'));
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && close()} />

<!-- Laptop: a drawer at the right that closes when you click outside; elsewhere: a page of its own. -->
<button class="scrim" aria-label={t('set.close')} tabindex="-1" onclick={close}></button>
<div class="drawer" role="dialog" aria-modal="false" aria-label={t('set.title')}>
  <header>
    <h2>{t('set.title')}</h2>
    <button class="btn small" bind:this={closeButton} onclick={close}>{t('set.close')}</button>
  </header>

  <div class="body">
    <section class="card group">
      <h3>{t('set.language')}</h3>
      <div class="line" role="group" aria-label={t('set.language')}>
        <button class="btn toggle" class:on={app.prefs.uiLang === 'de'} onclick={() => app.setUiLang('de')}>Deutsch</button>
        <button class="btn toggle" class:on={app.prefs.uiLang === 'en'} onclick={() => app.setUiLang('en')}>English</button>
      </div>
      <label class="check">
        <input type="checkbox" checked={app.prefs.simpleOnMobile} onchange={(e) => app.setSimple(e.currentTarget.checked)} />
        <span>{t('set.simple')}<br /><span class="hint">{t('set.simpleHint')}</span></span>
      </label>
    </section>

    <section class="card group">
      <h3>{t('set.defaults')}</h3>
      <p class="hint">{t('set.defaultsHint')}</p>
      <label class="field">
        <span>{t('st.noteNames')}</span>
        <select value={defaults.noteNames} onchange={(e) => app.setDefaults({ noteNames: e.currentTarget.value as 'de' | 'en' })}>
          <option value="de">{t('st.names.de')}</option>
          <option value="en">{t('st.names.en')}</option>
        </select>
      </label>
      <label class="field">
        <span>{t('st.language')}</span>
        <select value={defaults.language} onchange={(e) => app.setDefaults({ language: e.currentTarget.value as 'de' | 'en' })}>
          <option value="de">Deutsch</option>
          <option value="en">English</option>
        </select>
      </label>
      <div class="line">
        <button class="btn" disabled={!app.piece} onclick={saveLook}>{t('set.saveLook')}</button>
        <button class="btn" disabled={!app.prefs.defaultStyle} onclick={() => app.resetDefaults()}>{t('set.resetDefaults')}</button>
      </div>
      {#if !app.piece}<p class="hint">{t('set.noPiece')}</p>{/if}
    </section>

    <h3 class="sub">{t('set.sync')}</h3>
    <SyncPanel />

    <p class="about muted small">
      {t('appName')} {APP_VERSION} · {t('about.license')} ·
      <a href="./licenses/Inter-OFL.txt" target="_blank" rel="noopener">{t('about.fonts')}</a> ·
      <a href="./privacy.html" target="_blank" rel="noopener">{t('about.privacy')}</a>
    </p>
  </div>
</div>

<style>
  .scrim { all: unset; position: fixed; inset: var(--header-h) 0 0 0; z-index: 29; display: none; }
  .drawer {
    position: fixed; z-index: 30; top: var(--header-h); left: 0; right: 0; bottom: 0;
    display: flex; flex-direction: column; background: var(--bg, var(--surface)); overflow: hidden;
  }
  header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 16px; border-bottom: 1px solid var(--border); background: var(--surface); }
  header h2 { margin: 0; font-size: 1.1rem; }
  .body { display: grid; gap: 14px; align-content: start; padding: 16px; overflow-y: auto; flex: 1; grid-template-columns: minmax(0, 1fr); }
  .group { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; padding: 14px; }
  .group :global(.btn) { white-space: normal; height: auto; }
  .group select { width: 100%; }
  .group h3, .sub { margin: 0; font-size: 1rem; }
  .group p { margin: 0; }
  .check { display: flex; align-items: flex-start; gap: 8px; font-size: 0.95rem; }
  .check input { flex: none; margin-top: 2px; }
  .about { margin: 4px 0 0; }
  .about a { color: inherit; }

  @media (min-width: 900px) {
    /* laptop: full height, over the top bar too */
    .scrim { display: block; inset: 0; }
    .drawer { top: 0; left: auto; width: 440px; border-left: 1px solid var(--border); box-shadow: -8px 0 24px rgba(0, 0, 0, 0.12); }
    header { min-height: var(--header-h); box-sizing: border-box; }
  }
</style>
