<script lang="ts">
  import { untrack, type Snippet } from 'svelte';

  import { rememberOpen, wasOpen } from '../ui/remember';

  let {
    title,
    count,
    open = false,
    reveal = false,
    id,
    actions,
    children,
  }: { title: string; count?: number; open?: boolean; reveal?: boolean; id?: string; actions?: Snippet; children: Snippet } = $props();

  // With an id the panel remembers whether the user left it open; `open` is only the first-time default.
  const startOpen = untrack(() => (id ? wasOpen(id, open) : open));
  let el: HTMLDetailsElement | undefined = $state();
  let revealed = false;
  // Opens the panel when something inside it gets selected elsewhere (e.g. in the preview); that is not a choice to remember.
  $effect(() => {
    if (reveal && el && !el.open) {
      revealed = true;
      el.open = true;
    }
  });
  function toggled() {
    if (revealed) revealed = false;
    else if (id && el) rememberOpen(id, el.open);
  }
</script>

<details class="panel card" open={startOpen} bind:this={el} ontoggle={toggled}>
  <summary>
    <span class="chev" aria-hidden="true"></span>
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
  .count {
    margin-left: auto; font-size: 0.8rem; color: var(--muted); background: var(--surface-2);
    border: 1px solid var(--border); border-radius: 99px; padding: 0 8px;
  }
  .body { padding: 0 14px 14px; display: grid; gap: 10px; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; }
</style>
