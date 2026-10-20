<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    count,
    open = false,
    reveal = false,
    actions,
    children,
  }: { title: string; count?: number; open?: boolean; reveal?: boolean; actions?: Snippet; children: Snippet } = $props();

  let el: HTMLDetailsElement | undefined = $state();
  // Opens the panel when something inside it gets selected elsewhere (e.g. in the preview).
  $effect(() => {
    if (reveal && el) el.open = true;
  });
</script>

<details class="panel card" {open} bind:this={el}>
  <summary>
    <span class="chev" aria-hidden="true">›</span>
    <h3>{title}</h3>
    {#if count !== undefined}<span class="count">{count}</span>{/if}
  </summary>
  <div class="body">
    {@render children()}
    {#if actions}<div class="actions">{@render actions()}</div>{/if}
  </div>
</details>

<style>
  summary {
    display: flex; align-items: center; gap: 8px; padding: 12px 14px; cursor: pointer; list-style: none; user-select: none;
  }
  summary::-webkit-details-marker { display: none; }
  .chev { display: inline-block; width: 1em; transition: transform 0.15s; color: var(--muted); font-size: 1.2rem; line-height: 1; }
  details[open] > summary .chev { transform: rotate(90deg); }
  .count {
    margin-left: auto; font-size: 0.8rem; color: var(--muted); background: var(--surface-2);
    border: 1px solid var(--border); border-radius: 99px; padding: 0 8px;
  }
  .body { padding: 0 14px 14px; display: grid; gap: 10px; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; }
</style>
