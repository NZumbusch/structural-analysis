<script lang="ts">
  import { keyName, parseKey } from '../domain/keys';
  import type { Key, NoteNames } from '../domain/types';

  let {
    value,
    names,
    onchange,
    label = '',
  }: { value: Key; names: NoteNames; onchange: (key: Key) => void; label?: string } = $props();

  let text = $state('');
  let focused = false;
  let invalid = $state(false);

  $effect(() => {
    const shown = keyName(value, names);
    if (!focused) {
      text = shown;
      invalid = false;
    }
  });

  function oninput() {
    const key = parseKey(text, names);
    invalid = !key;
    if (key) onchange(key);
  }

  function onblur() {
    focused = false;
    invalid = false;
    text = keyName(value, names);
  }
</script>

<input
  type="text"
  class:invalid
  bind:value={text}
  {oninput}
  {onblur}
  onfocus={() => (focused = true)}
  aria-label={label}
  autocapitalize="off"
  autocomplete="off"
  autocorrect="off"
  spellcheck="false"
  inputmode="text"
/>
