<script lang="ts">
  let {
    value,
    onchange,
    step = 1,
    min,
    max,
    nullable = false,
    placeholder = '',
    label = '',
  }: {
    value: number | null;
    onchange: (value: number | null) => void;
    step?: number;
    min?: number;
    max?: number;
    nullable?: boolean;
    placeholder?: string;
    label?: string;
  } = $props();

  function oninput(e: Event & { currentTarget: HTMLInputElement }) {
    const raw = e.currentTarget.value.trim();
    if (raw === '') {
      if (nullable) onchange(null);
      return;
    }
    const v = parseFloat(raw.replace(',', '.'));
    if (Number.isFinite(v) && (min === undefined || v >= min) && (max === undefined || v <= max)) onchange(v);
  }
</script>

<input
  type="number"
  inputmode="decimal"
  {step}
  {min}
  {max}
  {placeholder}
  value={value ?? ''}
  {oninput}
  aria-label={label}
/>
