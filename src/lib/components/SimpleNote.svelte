<script lang="ts">
  import { t } from '../i18n/index.svelte';
  import { app } from '../stores/app.svelte';
</script>

{#if app.isMobile}
  <p class="note muted small">
    {app.prefs.simpleOnMobile ? t('mob.simple') : t('mob.full')}
    <button class="link" onclick={() => app.setSimple(!app.prefs.simpleOnMobile)}>
      {app.prefs.simpleOnMobile ? t('mob.showAll') : t('mob.goSimple')}
    </button>
  </p>
{/if}

<style>
  .note { margin: 0; padding: 0 2px; }
  .link { all: unset; cursor: pointer; text-decoration: underline; color: var(--accent); }
  .link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
