<script lang="ts">
  import { applyAllFixes, applyFix, validate, type Issue } from '../domain/validate';
  import { t, type TKey } from '../i18n/index.svelte';
  import { app } from '../stores/app.svelte';
  import type { Piece } from '../domain/types';

  let { piece }: { piece: Piece } = $props();

  const issues = $derived(validate(piece));
  const problems = $derived(issues.filter((i) => i.severity !== 'info'));
  const fixable = $derived(problems.filter((i) => i.fix));
  const icon = { error: '⛔', warning: '⚠', info: 'ℹ' } as const;

  function message(i: Issue): string {
    const params: Record<string, string | number> = { ...i.params };
    if (typeof params.kind === 'string') params.kind = t(`ev.${params.kind}` as TKey);
    return t(`val.${i.code}` as TKey, params);
  }

  function show(i: Issue) {
    const target = i.target;
    if (!target) return;
    if (target.kind === 'view') {
      app.activeViewId = target.id;
      app.tab = 'analysis';
    } else if (target.kind === 'event') {
      app.selection = { kind: 'event', id: target.id };
      app.tab = 'setup';
    } else {
      app.selection = { kind: target.kind, id: target.id };
      app.tab = 'analysis';
    }
  }

  function fix(i: Issue) {
    if (applyFix(piece, i)) app.notify(t('val.fixed', { n: 1 }));
  }

  function fixAll() {
    const n = applyAllFixes(piece);
    app.notify(t('val.fixed', { n }));
  }
</script>

{#if issues.length === 0}
  <p class="ok muted small">✓ {t('val.ok')}</p>
{:else}
  <details class="card box" open={problems.length > 0}>
    <summary>
      <span class="chev" aria-hidden="true"></span>
      <h3>{t('val.title')}</h3>
      <span class="count" class:bad={problems.length > 0}>{problems.length > 0 ? problems.length : issues.length}</span>
    </summary>
    <div class="body">
      <ul>
        {#each issues as i (i.id)}
          <li class={i.severity}>
            <span class="ico" aria-hidden="true">{icon[i.severity]}</span>
            <span class="msg">{message(i)}</span>
            <span class="acts">
              {#if i.target}<button class="btn small" onclick={() => show(i)}>{t('val.show')}</button>{/if}
              {#if i.fix}<button class="btn small primary" onclick={() => fix(i)}>{t(`fix.${i.fix.kind}` as TKey)}</button>{/if}
            </span>
          </li>
        {/each}
      </ul>
      {#if fixable.length > 1}
        <div class="line"><button class="btn small" onclick={fixAll}>{t('val.fixAll', { n: fixable.length })}</button></div>
      {/if}
      <p class="hint">{t('val.hint')}</p>
    </div>
  </details>
{/if}

<style>
  .ok { margin: 0; }
  summary { display: flex; align-items: center; gap: 8px; padding: 12px 14px; cursor: pointer; list-style: none; user-select: none; }
  summary::-webkit-details-marker { display: none; }
  .count { margin-left: auto; font-size: 0.8rem; color: var(--muted); border: 1px solid var(--border); border-radius: 99px; padding: 0 8px; }
  .count.bad { color: #fff; background: var(--danger); border-color: var(--danger); }
  .body { padding: 0 14px 14px; display: grid; gap: 10px; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  li { display: grid; grid-template-columns: auto 1fr; gap: 4px 8px; align-items: start; font-size: 0.9rem; }
  li .acts { grid-column: 2; display: flex; flex-wrap: wrap; gap: 6px; }
  li.info { color: var(--muted); }
  li.error .ico { color: var(--danger); }
</style>
