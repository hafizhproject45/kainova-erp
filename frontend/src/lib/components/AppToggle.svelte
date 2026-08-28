<script lang="ts">
  // Toggle Switch standar untuk field is_active di seluruh Master Data (MVP 3 Phase 1) —
  // menggantikan AppSelect ("Aktif"/"Nonaktif") pada form Add/Edit maupun Inline Quick Toggle di AppTable.
  import { Toggle } from 'flowbite-svelte';

  let {
    label = '',
    checked = $bindable(false),
    disabled = false,
    onchange,
    class: className = '',
  }: {
    label?: string;
    checked?: boolean;
    disabled?: boolean;
    onchange?: (value: boolean) => void;
    class?: string;
  } = $props();

  function handleChange() {
    onchange?.(checked);
  }
</script>

<div class="flex flex-col gap-1 {className}">
  {#if label}
    <span class="text-sm font-medium text-slate-700">{label}</span>
  {/if}
  <Toggle bind:checked {disabled} onchange={handleChange}>
    {checked ? 'Aktif' : 'Nonaktif'}
  </Toggle>
</div>
