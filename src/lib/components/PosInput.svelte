<script lang="ts">
  import { formatPos, parsePos, type MeterSource } from '../domain/positions';

  let {
    value,
    meter,
    onchange,
    label = '',
  }: { value: number; meter: MeterSource; onchange: (pos: number) => void; label?: string } = $props();

  let text = $state('');
  let focused = false;
  let invalid = $state(false);

  $effect(() => {
    const shown = formatPos(value, meter);
    if (!focused) {
      text = shown;
      invalid = false;
    }
  });

  function oninput() {
    const pos = parsePos(text, meter);
    invalid = pos === null;
    if (pos !== null) onchange(pos);
  }

  function onblur() {
    focused = false;
    invalid = false;
    text = formatPos(value, meter);
  }
</script>

<input
  type="text"
  inputmode="decimal"
  class:invalid
  bind:value={text}
  {oninput}
  {onblur}
  onfocus={() => (focused = true)}
  aria-label={label}
  autocomplete="off"
  spellcheck="false"
  placeholder="42:3"
/>
