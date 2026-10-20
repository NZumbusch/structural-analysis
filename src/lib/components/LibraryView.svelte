<script lang="ts">
  import { displayTitle } from '../domain/piece';
  import { renderChart } from '../render/chart';
  import { APP_VERSION } from '../export/stamp';
  import { app } from '../stores/app.svelte';
  import { t } from '../i18n/index.svelte';
  import type { Piece } from '../domain/types';

  function title(p: Piece): string {
    return displayTitle(p) || t('common.untitled');
  }

  function date(p: Piece): string {
    return new Date(p.updatedAt).toLocaleString(app.prefs.uiLang, { dateStyle: 'medium', timeStyle: 'short' });
  }

  function remove(p: Piece) {
    if (confirm(t('lib.confirmDelete'))) app.remove(p.id);
  }
</script>

<section class="wrap">
  <header class="head">
    <h2>{t('lib.heading')}</h2>
    <p class="muted small">{t('lib.hint')}</p>
  </header>

  {#if app.library.length === 0}
    <div class="empty card">
      <p>{t('lib.empty')}</p>
      <div class="line">
        <button class="btn primary" onclick={() => app.create()}>{t('lib.new')}</button>
        <button class="btn" onclick={() => app.createExample()}>{t('lib.example')}</button>
      </div>
    </div>
  {:else}
    <ul class="cards">
      {#each app.library as p (p.id)}
        <li class="card" class:current={app.piece?.id === p.id}>
          <button class="thumb" onclick={() => app.open(p)} aria-label={`${t('lib.open')}: ${title(p)}`}>
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html renderChart(p).svg}
          </button>
          <div class="info">
            <strong>{title(p)}</strong>
            <span class="muted small">{p.meta.catalog}{p.meta.catalog && p.meta.year ? ' · ' : ''}{p.meta.year}</span>
            <span class="muted small">{t('lib.edited', { date: date(p) })}</span>
          </div>
          <div class="line tools">
            <button class="btn small primary" onclick={() => app.open(p)}>{t('lib.open')}</button>
            <button class="btn small" onclick={() => app.duplicate(p)}>{t('lib.duplicate')}</button>
            <button class="btn small" onclick={() => app.saveProjectFile([p])}>{t('lib.export')}</button>
            <button class="btn small danger" onclick={() => remove(p)}>{t('common.delete')}</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  {#if app.showIosHint}
    <p class="muted small">{t('install.ios')}</p>
  {/if}

  <footer class="about muted small">
    <span>{t('appName')} {APP_VERSION}</span> ·
    <span>{t('about.license')}</span> ·
    <a href="./licenses/Inter-OFL.txt" target="_blank" rel="noopener">{t('about.fonts')}</a>
  </footer>
</section>

<style>
  .wrap { display: grid; gap: 16px; max-width: 1200px; margin: 0 auto; padding: 16px; }
  .head { display: grid; gap: 4px; }
  .empty { padding: 20px; display: grid; gap: 14px; }
  .cards {
    list-style: none; margin: 0; padding: 0; display: grid; gap: 14px;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
  }
  .cards li { display: grid; gap: 10px; padding: 12px; align-content: start; }
  .cards li.current { border-color: var(--accent); }
  .thumb {
    padding: 0; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: #fff; cursor: pointer; display: block;
  }
  .thumb :global(svg) { display: block; width: 100%; height: auto; }
  .info { display: grid; gap: 2px; }
  .tools { gap: 6px; }
  .about { margin-top: 8px; }
  .about a { color: inherit; }
</style>
