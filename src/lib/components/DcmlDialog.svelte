<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../i18n/index.svelte';
  import { app } from '../stores/app.svelte';
  import DcmlImport from './DcmlImport.svelte';

  const close = () => (app.dcmlOpen = false);
  let box: HTMLElement | undefined = $state();
  onMount(() => box?.focus());
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && close()} />

<div class="backdrop" role="presentation" onclick={close}></div>
<div class="dialog card" role="dialog" aria-modal="true" aria-label={t('dcml.title')} tabindex="-1" bind:this={box}>
  <header>
    <h2>{t('dcml.title')}</h2>
    <button class="btn small" onclick={close}>{t('set.close')}</button>
  </header>
  <div class="body"><DcmlImport /></div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 44; background: rgba(0, 0, 0, 0.35); }
  .dialog {
    position: fixed; z-index: 45; top: 5vh; left: 50%; transform: translateX(-50%);
    width: min(720px, calc(100vw - 24px)); max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; outline: none;
  }
  header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--border); }
  h2 { margin: 0; font-size: 1.1rem; }
  .body { padding: 14px 16px 16px; overflow-y: auto; }
  @media (max-width: 700px) {
    .dialog { top: 0; left: 0; transform: none; width: 100vw; max-height: 100vh; height: 100vh; border-radius: 0; }
  }
</style>
