<script lang="ts">
  import type { Tab } from '../stores/app.svelte';

  let { id }: { id: Exclude<Tab, 'library'> } = $props();
</script>

<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if id === 'piece'}
    <path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" />
  {:else if id === 'setup'}
    <rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 12h16M12 4v16" />
  {:else if id === 'analysis'}
    <path d="M4 7h4M4 12h4M4 17h4" /><path d="M11 7h9M11 12h6M11 17h8" />
  {:else if id === 'stats'}
    <path d="M5 20V11M12 20V4M19 20v-6" />
  {:else if id === 'look'}
    <path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-1.2-1-1.6-1-2.7 0-.9.7-1.5 1.6-1.5H17a4 4 0 0 0 4-4C21 6.7 17 3 12 3z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7.5" r="1" /><circle cx="15" cy="7.5" r="1" />
  {:else}
    <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14" />
  {/if}
</svg>
