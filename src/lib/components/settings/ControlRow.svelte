<script lang="ts">
  import { t } from '../../i18n/index.svelte';
  import { formatNumber } from '../../analysis/csv';
  import { app } from '../../stores/app.svelte';
  import { getValue, setValue, type Roots, type Setting } from '../../settings/registry';
  import NumInput from '../NumInput.svelte';

  let { setting, roots }: { setting: Setting; roots: Roots } = $props();

  const c = $derived(setting.control);
  const path = $derived(c.type === 'custom' ? '' : c.path);
  const value = $derived(c.type === 'custom' ? undefined : getValue(roots, path));
  const set = (v: unknown) => setValue(roots, path, v);

  function shown(v: unknown): string {
    if (c.type !== 'range') return '';
    const n = Number(v);
    return c.format === 'pct' ? `${Math.round(n * 100)} %` : formatNumber(n, app.prefs.uiLang, 2);
  }
</script>

{#if c.type === 'toggle'}
  <label class="check"><input type="checkbox" checked={value === true} onchange={(e) => set(e.currentTarget.checked)} />{t(setting.label)}</label>
{:else if c.type === 'select'}
  <label class="field">
    <span>{t(setting.label)}</span>
    <select value={String(value)} onchange={(e) => set(typeof c.options[0].value === 'number' ? Number(e.currentTarget.value) : e.currentTarget.value)}>
      {#each c.options as o (o.value)}
        <option value={String(o.value)}>{typeof o.label === 'string' ? t(o.label) : o.label.text}</option>
      {/each}
    </select>
  </label>
{:else if c.type === 'range'}
  <label class="field">
    <span>{t(setting.label)}: {shown(value)}</span>
    <input type="range" min={c.min} max={c.max} step={c.step} value={Number(value)} oninput={(e) => set(Number(e.currentTarget.value))} />
  </label>
{:else if c.type === 'number'}
  <div class="field">
    <span>{t(setting.label)}</span>
    <NumInput
      label={t(setting.label)}
      min={c.min}
      max={c.max}
      step={c.step ?? 1}
      nullable={c.nullable}
      placeholder={c.nullable ? t('common.auto') : ''}
      value={(value as number | null) ?? null}
      onchange={(v) => set(c.nullable ? v : (v ?? 0))}
    />
  </div>
{:else if c.type === 'text'}
  <label class="field">
    <span>{t(setting.label)}</span>
    <input type="text" value={String(value ?? '')} placeholder={c.placeholder ? t(c.placeholder) : ''} oninput={(e) => set(e.currentTarget.value)} />
  </label>
{/if}
{#if setting.hint && c.type !== 'custom'}<p class="hint">{t(setting.hint)}</p>{/if}

<style>
  .check { display: flex; align-items: center; gap: 8px; font-size: 0.95rem; }
  p { margin: 0; }
</style>
