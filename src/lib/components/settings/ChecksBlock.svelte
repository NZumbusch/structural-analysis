<script lang="ts">
  import { validate } from '../../domain/validate';
  import type { Piece } from '../../domain/types';
  import { countNotes, publicationChecks } from '../../export/checks';
  import type { ExportPrefs } from '../../export/prefs';
  import type { ViewRange } from '../../render/chart';
  import { t } from '../../i18n/index.svelte';

  let { piece, exp, range }: { piece: Piece; exp: ExportPrefs; range: ViewRange | null } = $props();

  const problems = $derived(validate(piece).filter((i) => i.severity !== 'info').length);
  const checks = $derived(publicationChecks(piece, { widthCm: exp.widthCm, fonts: exp.fonts, problems, view: range }));
  const notes = $derived(countNotes(checks));
</script>

<p class="sum" class:warn={notes > 0}>{notes > 0 ? t('chk.some', { n: notes }) : t('chk.ok')}</p>
<ul>
  {#each checks as c (c.id)}
    <li class={c.level}>
      <span class="mark" aria-hidden="true">{c.level === 'ok' ? '✓' : c.level === 'warn' ? '⚠' : 'ℹ'}</span>
      <span>{t(c.key, c.params)}</span>
    </li>
  {/each}
</ul>

<style>
  .sum { margin: 0 0 4px; font-weight: 600; }
  .sum.warn { color: #a6670a; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; font-size: 0.9rem; }
  li { display: grid; grid-template-columns: 18px 1fr; gap: 6px; align-items: start; }
  .ok .mark { color: var(--accent); }
  .warn .mark { color: #a6670a; }
  .info .mark { color: var(--muted); }
</style>
