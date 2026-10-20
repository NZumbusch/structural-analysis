<script lang="ts">
  import { downloadRescue, removeAllData, resetCaches, resetSettings } from '../recovery';

  let { error, reset }: { error: unknown; reset: () => void } = $props();

  const message = $derived(error instanceof Error ? error.message : String(error));

  async function reload(clean: boolean) {
    if (clean) await resetCaches();
    location.reload();
  }
  async function resetPrefs() {
    resetSettings();
    await reload(true);
  }
  async function wipe() {
    if (!confirm('Alle gespeicherten Stücke und Einstellungen in diesem Browser löschen? / Delete all saved pieces and settings in this browser?')) return;
    removeAllData();
    await reload(true);
  }
</script>

<main class="err">
  <h2>Etwas ist schiefgelaufen · Something went wrong</h2>
  <p>
    Die Seite konnte nicht angezeigt werden – häufig nach einem Update mit älteren gespeicherten Daten. Deine Stücke sind noch gespeichert.<br />
    The page could not be shown – often after an update, with data saved by an older version. Your pieces are still stored.
  </p>
  <pre>{message}</pre>
  <div class="actions">
    <button class="btn primary" onclick={() => resetPrefs()}>1 · Einstellungen zurücksetzen &amp; neu laden / Reset settings &amp; reload</button>
    <button class="btn" onclick={() => reload(true)}>Neu laden (Cache leeren) / Reload (clear cache)</button>
    <button class="btn" onclick={reset}>Nochmal versuchen / Try again</button>
    <button class="btn" onclick={downloadRescue}>Daten als Datei retten / Save my data as a file</button>
    <button class="btn danger" onclick={wipe}>Alles löschen / Delete everything</button>
  </div>
</main>

<style>
  .err { max-width: 640px; margin: 0 auto; padding: 24px 16px; display: grid; gap: 14px; }
  pre { white-space: pre-wrap; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px; font-size: 0.8rem; margin: 0; }
  .actions { display: grid; gap: 8px; }
  .actions :global(.btn) { white-space: normal; text-align: left; justify-content: flex-start; height: auto; padding: 10px 14px; }
</style>
