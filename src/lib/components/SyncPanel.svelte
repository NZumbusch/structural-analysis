<script lang="ts">
  import { t, type TKey } from '../i18n/index.svelte';
  import { app } from '../stores/app.svelte';
  import { sync } from '../stores/sync.svelte';
  import Panel from './Panel.svelte';

  const GUIDE = 'https://github.com/NZumbusch/structural-analysis/blob/main/docs/sync-setup.md';
  let clientId = $state(app.prefs.sync.clientId);

  const time = $derived(
    app.prefs.sync.lastSync ? new Date(app.prefs.sync.lastSync).toLocaleTimeString(app.prefs.uiLang, { timeStyle: 'short' }) : '',
  );
  const problem = $derived.by(() => {
    const p = sync.problem;
    if (!p) return '';
    if (p.startsWith('http-')) return t('sync.p.http', { msg: p.slice(p.indexOf(':') + 1) });
    const key = `sync.p.${p}` as TKey;
    return t(key) === key ? t('sync.p.denied') : t(key);
  });
</script>

<Panel id="set.sync" title={t('sync.title')} open={app.prefs.sync.enabled}>
  <div class="box">
    <p class="muted small">{t('sync.intro')}</p>

    {#if !app.prefs.sync.enabled}
      {#if sync.builtIn}
        <p class="hint">{t('sync.builtIn')}</p>
      {:else}
        <div class="field">
          <span>{t('sync.clientId')}</span>
          <div class="line">
            <input class="grow mono" type="text" placeholder="123456789-abc….apps.googleusercontent.com" bind:value={clientId} autocapitalize="off" autocomplete="off" spellcheck="false" onchange={() => sync.setClientId(clientId)} />
          </div>
          <span class="hint">{t('sync.clientHelp')} <a href={GUIDE} target="_blank" rel="noopener">{t('sync.guide')}</a></span>
        </div>
      {/if}
      <div class="line">
        <button class="btn primary" disabled={!sync.clientId && !clientId.trim()} onclick={() => { sync.setClientId(sync.builtIn ? '' : clientId); void sync.signIn(); }}>{t('sync.connect')}</button>
      </div>
    {:else}
      <p role="status" class:err={sync.status === 'error'}>
        {#if sync.status === 'syncing'}{t('sync.syncing')}
        {:else if sync.status === 'signed-out'}{t('sync.signedOut')}
        {:else if time}{t('sync.idle', { time })}
        {:else}{t('sync.never')}{/if}
      </p>
      {#if sync.report && sync.status !== 'syncing'}
        <p class="muted small">{t('sync.report', { up: sync.report.uploaded, down: sync.report.downloaded, conf: sync.report.conflicts, del: sync.report.deletedHere + sync.report.deletedThere })}</p>
      {/if}
      <div class="line">
        {#if sync.status === 'signed-out'}
          <button class="btn primary" onclick={() => sync.signIn()}>{t('sync.signIn')}</button>
        {:else}
          <button class="btn primary" disabled={sync.status === 'syncing'} onclick={() => sync.syncNow()}>{t('sync.now')}</button>
        {/if}
        <button class="btn" onclick={() => sync.disconnect()}>{t('sync.disconnect')}</button>
      </div>
      <p class="hint">{t('sync.disconnectHint')}</p>
    {/if}
    {#if problem}<p class="err" role="alert">{problem}</p>{/if}
  </div>
</Panel>

<style>
  .box { display: grid; gap: 12px; padding: 0 14px 14px; }
  .box p { margin: 0; }
</style>
